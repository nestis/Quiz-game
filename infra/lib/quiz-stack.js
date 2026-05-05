const { Stack, RemovalPolicy } = require('aws-cdk-lib');
const dynamodb = require('aws-cdk-lib/aws-dynamodb');

/**
 * QuizBlitz – DynamoDB infrastructure (CDK)
 *
 * The application itself runs on Fly.io (Docker container).
 * This stack manages only the DynamoDB tables so they survive
 * independent of wherever the app is hosted.
 *
 * All tables use PAY_PER_REQUEST – $0 when idle.
 */
class QuizBlitzStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    const gamesTable = new dynamodb.Table(this, 'GamesTable', {
      tableName:      'QuizBlitz_Games',
      partitionKey:   { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode:    dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy:  RemovalPolicy.RETAIN,
    });

    const questionsTable = new dynamodb.Table(this, 'QuestionsTable', {
      tableName:    'QuizBlitz_Questions',
      partitionKey: { name: 'gameId', type: dynamodb.AttributeType.STRING },
      sortKey:      { name: 'id',     type: dynamodb.AttributeType.STRING },
      billingMode:  dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const sessionsTable = new dynamodb.Table(this, 'SessionsTable', {
      tableName:    'QuizBlitz_Sessions',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode:  dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    sessionsTable.addGlobalSecondaryIndex({
      indexName:    'pin-index',
      partitionKey: { name: 'pin', type: dynamodb.AttributeType.STRING },
    });
    sessionsTable.addGlobalSecondaryIndex({
      indexName:    'gameId-index',
      partitionKey: { name: 'gameId', type: dynamodb.AttributeType.STRING },
    });

    const playersTable = new dynamodb.Table(this, 'PlayersTable', {
      tableName:    'QuizBlitz_Players',
      partitionKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
      sortKey:      { name: 'id',        type: dynamodb.AttributeType.STRING },
      billingMode:  dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const usersTable = new dynamodb.Table(this, 'UsersTable', {
      tableName:    'QuizBlitz_Users',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode:  dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    usersTable.addGlobalSecondaryIndex({
      indexName:    'username-index',
      partitionKey: { name: 'username', type: dynamodb.AttributeType.STRING },
    });

    // Suppress unused-variable lint; tables are retained by CDK removal policy
    void [gamesTable, questionsTable, sessionsTable, playersTable, usersTable];
  }
}

module.exports = { QuizBlitzStack };
