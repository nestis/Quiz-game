const { Stack, CfnOutput, RemovalPolicy, Duration } = require('aws-cdk-lib');
const dynamodb    = require('aws-cdk-lib/aws-dynamodb');
const lambda      = require('aws-cdk-lib/aws-lambda');
const apigwv2     = require('aws-cdk-lib/aws-apigatewayv2');
const integrations = require('aws-cdk-lib/aws-apigatewayv2-integrations');

class QuizBlitzStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // ── DynamoDB Tables ──────────────────────────────────────────────────
    // All PAY_PER_REQUEST – no provisioned capacity cost when idle.

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
      indexName:     'pin-index',
      partitionKey:  { name: 'pin',    type: dynamodb.AttributeType.STRING },
    });
    sessionsTable.addGlobalSecondaryIndex({
      indexName:     'gameId-index',
      partitionKey:  { name: 'gameId', type: dynamodb.AttributeType.STRING },
    });

    const playersTable = new dynamodb.Table(this, 'PlayersTable', {
      tableName: 'QuizBlitz_Players',
      partitionKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
      sortKey:      { name: 'id',        type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // ── Lambda Function ──────────────────────────────────────────────────
    // No VPC needed – Lambda accesses DynamoDB via AWS service endpoints.
    // This avoids NAT Gateway (~$32/mo) and ALB (~$18/mo) costs entirely.

    const fn = new lambda.Function(this, 'QuizFn', {
      functionName:  'quizblitz',
      runtime:       lambda.Runtime.NODEJS_20_X,
      handler:       'server/lambda.handler',
      code: lambda.Code.fromAsset('..', {
        exclude: [
          'infra', 'infra/**',
          '.git', '.git/**',
          'docker-data', 'docker-data/**',
          'Dockerfile', 'docker-compose.yml', '.dockerignore',
          '*.md',
        ],
      }),
      timeout:    Duration.seconds(30),
      memorySize: 256,
      environment: {
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
        GAMES_TABLE:     gamesTable.tableName,
        QUESTIONS_TABLE: questionsTable.tableName,
        SESSIONS_TABLE:  sessionsTable.tableName,
        PLAYERS_TABLE:   playersTable.tableName,
        SEED_ON_START:   'true',
      },
    });

    // Grant read/write on all tables
    for (const t of [gamesTable, questionsTable, sessionsTable, playersTable]) {
      t.grantReadWriteData(fn);
    }

    // ── HTTP API Gateway (v2) ────────────────────────────────────────────
    // ~$1/million requests – orders of magnitude cheaper than ALB.

    const integration = new integrations.HttpLambdaIntegration('QuizIntegration', fn);

    const api = new apigwv2.HttpApi(this, 'QuizApi', {
      apiName:            'quizblitz',
      defaultIntegration: integration,
    });

    // ── Outputs ──────────────────────────────────────────────────────────

    new CfnOutput(this, 'QuizBlitzUrl', {
      value:       api.apiEndpoint,
      description: 'QuizBlitz public URL',
    });
  }
}

module.exports = { QuizBlitzStack };
