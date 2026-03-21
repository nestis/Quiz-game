#!/usr/bin/env node
const cdk = require('aws-cdk-lib');
const { QuizBlitzStack } = require('../lib/quiz-stack');

const app = new cdk.App();

new QuizBlitzStack(app, 'QuizBlitzStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
});
