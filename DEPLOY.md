# Deploying QuizBlitz to AWS

Deployments are automated via GitHub Actions on every push to `main`.
No AWS access keys are stored in GitHub — authentication uses **OIDC** (short-lived tokens).

---

## One-time AWS setup

Run these commands once in your AWS account (replace the placeholders).

### 1. Create the GitHub OIDC provider

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

### 2. Create the IAM deploy role

Replace `YOUR_GITHUB_ORG` and `YOUR_REPO_NAME`:

```bash
aws iam create-role \
  --role-name QuizBlitzDeploy \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": { "Federated": "arn:aws:iam::'"$(aws sts get-caller-identity --query Account --output text)"':oidc-provider/token.actions.githubusercontent.com" },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:YOUR_GITHUB_ORG/YOUR_REPO_NAME:*"
        },
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        }
      }
    }]
  }'
```

### 3. Attach permissions to the role

CDK needs permissions for CloudFormation, ECR, App Runner, DynamoDB, IAM, and S3 (bootstrap bucket).
The quickest approach for a private project is `AdministratorAccess`; for tighter security use the policy below.

```bash
# Quick (recommended for private/dev projects)
aws iam attach-role-policy \
  --role-name QuizBlitzDeploy \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
```

<details>
<summary>Least-privilege policy (production)</summary>

```bash
aws iam put-role-policy \
  --role-name QuizBlitzDeploy \
  --policy-name QuizBlitzDeployPolicy \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      { "Effect": "Allow", "Action": ["cloudformation:*"],   "Resource": "*" },
      { "Effect": "Allow", "Action": ["ecr:*"],              "Resource": "*" },
      { "Effect": "Allow", "Action": ["apprunner:*"],        "Resource": "*" },
      { "Effect": "Allow", "Action": ["dynamodb:*"],         "Resource": "*" },
      { "Effect": "Allow", "Action": ["iam:*"],              "Resource": "*" },
      { "Effect": "Allow", "Action": ["s3:*"],               "Resource": "*" },
      { "Effect": "Allow", "Action": ["ssm:GetParameter"],   "Resource": "*" }
    ]
  }'
```

</details>

### 4. Copy the role ARN

```bash
aws iam get-role --role-name QuizBlitzDeploy --query Role.Arn --output text
```

---

## GitHub repository setup

1. Go to your repo → **Settings → Secrets and variables → Actions**
2. Click **New repository secret**
3. Name: `AWS_DEPLOY_ROLE_ARN`
   Value: the ARN from step 4 above (`arn:aws:iam::123456789012:role/QuizBlitzDeploy`)

---

## Triggering a deploy

| Trigger | How |
|---------|-----|
| **Automatic** | Push or merge to `main` |
| **Manual** | GitHub → Actions → "Deploy QuizBlitz" → "Run workflow" |

The workflow will:
1. Install Node.js dependencies
2. Authenticate to AWS via OIDC (no stored secrets)
3. Run `cdk bootstrap` (safe to re-run, skips if already done)
4. Build the Docker image and push it to ECR
5. Deploy/update the App Runner service and DynamoDB tables

The public URL is printed at the end of the CDK output:
```
QuizBlitzStack.QuizBlitzUrl = https://xxxxxxxxxxxx.us-east-1.awsapprunner.com
```

---

## Local development

```bash
docker compose up --build   # app on :3000, DynamoDB Local on :8000
```

## Manual deploy (without GitHub Actions)

```bash
cd infra
npm ci
npx cdk bootstrap   # first time only
npx cdk deploy --all
```
