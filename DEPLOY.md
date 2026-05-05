# QuizBlitz – Deployment Guide

## Architecture

```
Fly.io (Docker container)  →  AWS DynamoDB (5 tables)
      ↑
GitHub Actions (CI/CD)
```

- **App**: Fly.io – Docker container, WebSocket-capable, ~$3/mo (scales to zero when idle)
- **Database**: AWS DynamoDB – pay-per-request, ~$0 for a quiz game
- **CI/CD**: GitHub Actions – auto-deploys on push to `main`

---

## One-time setup

### 1 – AWS: DynamoDB IAM user

Create an IAM user with programmatic access and attach this inline policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem",
      "dynamodb:DeleteItem", "dynamodb:Query", "dynamodb:Scan",
      "dynamodb:BatchWriteItem"
    ],
    "Resource": "arn:aws:dynamodb:eu-west-1:*:table/QuizBlitz_*"
  }]
}
```

Save the **Access Key ID** and **Secret Access Key** – you will need them in step 3.

### 2 – AWS: OIDC role for CDK (GitHub Actions → AWS)

This lets GitHub Actions deploy the DynamoDB tables without stored keys.

```bash
# Create the OIDC provider (once per AWS account)
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com
```

Create an IAM role with this trust policy (replace placeholders):

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
    },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringLike": {
        "token.actions.githubusercontent.com:sub": "repo:YOUR_ORG/YOUR_REPO:*"
      }
    }
  }]
}
```

Attach **AdministratorAccess** (or a policy scoped to DynamoDB + CDK bootstrap resources).

### 3 – Fly.io: create the app

```bash
# Install flyctl
brew install flyctl          # macOS
# or: curl -L https://fly.io/install.sh | sh

fly auth login

# Edit fly.toml: set a unique app name, then register it
fly launch --no-deploy

# Set secrets (never stored in git)
fly secrets set \
  JWT_SECRET="$(openssl rand -hex 32)" \
  ADMIN_USERNAME="admin" \
  ADMIN_PASSWORD="your-secure-password" \
  AWS_ACCESS_KEY_ID="AKIA..." \
  AWS_SECRET_ACCESS_KEY="..."
```

### 4 – GitHub secrets

Add these in **Settings → Secrets and variables → Actions**:

| Secret | Value |
|--------|-------|
| `AWS_DEPLOY_ROLE_ARN` | ARN of the OIDC role from step 2 |
| `FLY_API_TOKEN` | Output of `fly tokens create deploy` |

---

## Deploying

### Automatic
Push to `main` → GitHub Actions runs both jobs automatically:
1. **CDK** – creates/updates DynamoDB tables
2. **Fly** – builds and deploys the Docker container

### Manual (first deploy or local CLI)
```bash
# Deploy DynamoDB tables
cd infra && npx cdk deploy --all

# Deploy the app
fly deploy
```

---

## Local development

```bash
docker compose up --build
# App:  http://localhost:3000
# Login: admin / admin1234
```

---

## Cost estimate

| Resource | Cost |
|----------|------|
| Fly.io shared-cpu-1x 256 MB (auto-stops when idle) | ~$0–3/mo |
| AWS DynamoDB (pay-per-request, low traffic) | ~$0/mo |
| **Total** | **~$0–3/mo** |
