const cdk = require('aws-cdk-lib');
const dynamodb = require('aws-cdk-lib/aws-dynamodb');
const ecs = require('aws-cdk-lib/aws-ecs');
const ec2 = require('aws-cdk-lib/aws-ec2');
const ecsPatterns = require('aws-cdk-lib/aws-ecs-patterns');
const logs = require('aws-cdk-lib/aws-logs');

class QuizBlitzStack extends cdk.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // ── DynamoDB Tables ──────────────────────────────────────────────────

    const gamesTable = new dynamodb.Table(this, 'GamesTable', {
      tableName: 'QuizBlitz_Games',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const questionsTable = new dynamodb.Table(this, 'QuestionsTable', {
      tableName: 'QuizBlitz_Questions',
      partitionKey: { name: 'gameId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const sessionsTable = new dynamodb.Table(this, 'SessionsTable', {
      tableName: 'QuizBlitz_Sessions',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    sessionsTable.addGlobalSecondaryIndex({
      indexName: 'pin-index',
      partitionKey: { name: 'pin', type: dynamodb.AttributeType.STRING },
    });
    sessionsTable.addGlobalSecondaryIndex({
      indexName: 'gameId-index',
      partitionKey: { name: 'gameId', type: dynamodb.AttributeType.STRING },
    });

    const playersTable = new dynamodb.Table(this, 'PlayersTable', {
      tableName: 'QuizBlitz_Players',
      partitionKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ── VPC ──────────────────────────────────────────────────────────────

    const vpc = new ec2.Vpc(this, 'QuizVpc', {
      maxAzs: 2,
      natGateways: 1,
    });

    // ── ECS Cluster ──────────────────────────────────────────────────────

    const cluster = new ecs.Cluster(this, 'QuizCluster', {
      vpc,
      clusterName: 'quizblitz',
    });

    // ── Fargate Service + ALB ────────────────────────────────────────────

    const service = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'QuizService', {
      cluster,
      serviceName: 'quizblitz-web',
      cpu: 256,
      memoryLimitMiB: 512,
      desiredCount: 1,
      taskImageOptions: {
        image: ecs.ContainerImage.fromAsset('../'), // builds Docker image from project root
        containerPort: 3000,
        environment: {
          PORT: '3000',
          AWS_REGION: this.region,
          GAMES_TABLE: gamesTable.tableName,
          QUESTIONS_TABLE: questionsTable.tableName,
          SESSIONS_TABLE: sessionsTable.tableName,
          PLAYERS_TABLE: playersTable.tableName,
          SEED_ON_START: 'true',
        },
        logDriver: ecs.LogDrivers.awsLogs({
          streamPrefix: 'quizblitz',
          logRetention: logs.RetentionDays.ONE_WEEK,
        }),
      },
      publicLoadBalancer: true,
    });

    // Health check
    service.targetGroup.configureHealthCheck({
      path: '/api/games',
      healthyHttpCodes: '200',
    });

    // Grant DynamoDB access to the Fargate task
    gamesTable.grantReadWriteData(service.taskDefinition.taskRole);
    questionsTable.grantReadWriteData(service.taskDefinition.taskRole);
    sessionsTable.grantReadWriteData(service.taskDefinition.taskRole);
    playersTable.grantReadWriteData(service.taskDefinition.taskRole);

    // ── Outputs ──────────────────────────────────────────────────────────

    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: service.loadBalancer.loadBalancerDnsName,
      description: 'QuizBlitz URL',
    });
  }
}

module.exports = { QuizBlitzStack };
