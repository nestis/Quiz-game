const path = require('path');
const { Stack, CfnOutput, RemovalPolicy } = require('aws-cdk-lib');
const dynamodb   = require('aws-cdk-lib/aws-dynamodb');
const iam        = require('aws-cdk-lib/aws-iam');
const assets     = require('aws-cdk-lib/aws-ecr-assets');
const apprunner  = require('aws-cdk-lib/aws-apprunner');

/**
 * QuizBlitz – AWS CDK Stack
 *
 * Architecture:
 *   App Runner (WebSocket-capable container) → DynamoDB (4 tables)
 *
 * Why App Runner over Lambda:
 *   Lambda doesn't support persistent WebSocket connections.
 *   App Runner is serverless-container (no VPC/NAT/ALB needed),
 *   supports Socket.io, and costs ~$5-10/mo for a quiz game.
 *
 * Cost estimate (0.25 vCPU / 0.5 GB):
 *   Active:      ~$0.02/hour   ($14/mo if always-on)
 *   Provisioned: ~$0.005/hour  (scales to near-zero when idle)
 *   DynamoDB:    ~$0           (pay-per-request, tiny traffic)
 */
class QuizBlitzStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // ── DynamoDB Tables ──────────────────────────────────────────────
    // All PAY_PER_REQUEST – zero cost when the game isn't being played.

    const gamesTable = new dynamodb.Table(this, 'GamesTable', {
      tableName: 'QuizBlitz_Games',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const questionsTable = new dynamodb.Table(this, 'QuestionsTable', {
      tableName: 'QuizBlitz_Questions',
      partitionKey: { name: 'gameId', type: dynamodb.AttributeType.STRING },
      sortKey:      { name: 'id',     type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const sessionsTable = new dynamodb.Table(this, 'SessionsTable', {
      tableName: 'QuizBlitz_Sessions',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    sessionsTable.addGlobalSecondaryIndex({
      indexName:    'pin-index',
      partitionKey: { name: 'pin',    type: dynamodb.AttributeType.STRING },
    });
    sessionsTable.addGlobalSecondaryIndex({
      indexName:    'gameId-index',
      partitionKey: { name: 'gameId', type: dynamodb.AttributeType.STRING },
    });

    const playersTable = new dynamodb.Table(this, 'PlayersTable', {
      tableName: 'QuizBlitz_Players',
      partitionKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
      sortKey:      { name: 'id',        type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const usersTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: 'QuizBlitz_Users',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    usersTable.addGlobalSecondaryIndex({
      indexName:    'username-index',
      partitionKey: { name: 'username', type: dynamodb.AttributeType.STRING },
    });

    const tables = [gamesTable, questionsTable, sessionsTable, playersTable, usersTable];

    // ── Docker image (built from project root Dockerfile) ────────────
    const image = new assets.DockerImageAsset(this, 'QuizImage', {
      directory: path.join(__dirname, '../..'),
    });

    // ── IAM: App Runner → ECR (pull image) ──────────────────────────
    const accessRole = new iam.Role(this, 'AppRunnerAccessRole', {
      assumedBy: new iam.ServicePrincipal('build.apprunner.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSAppRunnerServicePolicyForECRAccess'
        ),
      ],
    });

    // ── IAM: App Runner instance → DynamoDB ─────────────────────────
    const instanceRole = new iam.Role(this, 'AppRunnerInstanceRole', {
      assumedBy: new iam.ServicePrincipal('tasks.apprunner.amazonaws.com'),
    });
    for (const t of tables) t.grantReadWriteData(instanceRole);

    // ── App Runner Service ───────────────────────────────────────────
    // No VPC, no NAT Gateway, no ALB – App Runner manages all of that.
    const service = new apprunner.CfnService(this, 'QuizService', {
      serviceName: 'quizblitz',
      sourceConfiguration: {
        authenticationConfiguration: { accessRoleArn: accessRole.roleArn },
        imageRepository: {
          imageIdentifier:    image.imageUri,
          imageRepositoryType: 'ECR',
          imageConfiguration: {
            port: '3000',
            runtimeEnvironmentVariables: [
              { name: 'PORT',             value: '3000'                    },
              { name: 'SEED_ON_START',    value: 'true'                    },
              { name: 'GAMES_TABLE',      value: gamesTable.tableName      },
              { name: 'QUESTIONS_TABLE',  value: questionsTable.tableName  },
              { name: 'SESSIONS_TABLE',   value: sessionsTable.tableName   },
              { name: 'PLAYERS_TABLE',    value: playersTable.tableName    },
              { name: 'USERS_TABLE',      value: usersTable.tableName      },
              // JWT_SECRET and ADMIN_PASSWORD should be set as secrets in App Runner
              // or overridden via AWS SSM; fallback values here are for reference only.
              { name: 'JWT_SECRET',       value: process.env.JWT_SECRET    || 'CHANGE_ME_IN_PROD' },
              { name: 'ADMIN_USERNAME',   value: process.env.ADMIN_USERNAME || 'admin'            },
              { name: 'ADMIN_PASSWORD',   value: process.env.ADMIN_PASSWORD || 'CHANGE_ME_IN_PROD' },
            ],
          },
        },
      },
      instanceConfiguration: {
        instanceRoleArn: instanceRole.roleArn,
        cpu:    '0.25 vCPU',
        memory: '0.5 GB',
      },
      healthCheckConfiguration: {
        protocol: 'HTTP',
        path:     '/api/games',
        interval: 10,
        timeout:  5,
        healthyThreshold:   1,
        unhealthyThreshold: 3,
      },
    });

    // ── Output ───────────────────────────────────────────────────────
    new CfnOutput(this, 'QuizBlitzUrl', {
      value:       `https://${service.attrServiceUrl}`,
      description: 'QuizBlitz public URL (App Runner)',
    });
  }
}

module.exports = { QuizBlitzStack };
