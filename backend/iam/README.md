# One-time deploy bootstrap (run this with your root/admin session)

This creates a scoped IAM user for deploying the `backend/template.yaml`
stack, so day-to-day deploys never touch your root account again. Two
identities get created:

- **`STACK_NAME-cfn-exec-role`** — the *real* permissions (Lambda, the
  Lambda's own execution role, API Gateway, Secrets Manager, CloudWatch
  Logs), scoped to resource names starting with `STACK_NAME-`. Only
  CloudFormation itself can assume this — nobody logs in as it directly.
- **`STACK_NAME-deployer`** — the IAM user you'll actually use. It can only
  manage CloudFormation stacks named `STACK_NAME*` and hand that one
  execution role to CloudFormation (`iam:PassRole`, restricted by a
  condition to CloudFormation specifically). It has no direct Lambda/IAM/
  Secrets Manager permissions of its own — if these access keys ever leak,
  the attacker can redeploy this one stack and nothing else in your account.

Requires the AWS CLI, authenticated as root (or an admin) for this bootstrap
only.

```bash
# --- 0. Pick your values ---------------------------------------------------
export AWS_REGION=us-east-1              # wherever you want to deploy
export STACK_NAME=buildflow-backend      # must match what you pass to `sam deploy --stack-name`
export ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

cd backend/iam

# --- 1. S3 bucket for SAM's uploaded deployment packages -------------------
# Bucket names are globally unique across ALL of AWS, not just your account —
# if this exact name is taken, add a random suffix and update deploy-user-
# permissions-policy.json's Resource ARNs to match before step 4.
aws s3 mb "s3://${STACK_NAME}-sam-artifacts" --region "$AWS_REGION"

# --- 2. Fill in the policy templates ----------------------------------------
sed -e "s/REGION/$AWS_REGION/g" -e "s/ACCOUNT_ID/$ACCOUNT_ID/g" -e "s/STACK_NAME/$STACK_NAME/g" \
  cfn-execution-permissions-policy.json > /tmp/cfn-execution-permissions-policy.json
sed -e "s/REGION/$AWS_REGION/g" -e "s/ACCOUNT_ID/$ACCOUNT_ID/g" -e "s/STACK_NAME/$STACK_NAME/g" \
  deploy-user-permissions-policy.json > /tmp/deploy-user-permissions-policy.json

# --- 3. CloudFormation execution role ---------------------------------------
aws iam create-role \
  --role-name "${STACK_NAME}-cfn-exec-role" \
  --assume-role-policy-document file://cfn-execution-trust-policy.json

aws iam put-role-policy \
  --role-name "${STACK_NAME}-cfn-exec-role" \
  --policy-name "${STACK_NAME}-cfn-exec-permissions" \
  --policy-document file:///tmp/cfn-execution-permissions-policy.json

# --- 4. The deploy user itself -----------------------------------------------
aws iam create-user --user-name "${STACK_NAME}-deployer"

aws iam put-user-policy \
  --user-name "${STACK_NAME}-deployer" \
  --policy-name "${STACK_NAME}-deploy-permissions" \
  --policy-document file:///tmp/deploy-user-permissions-policy.json

# --- 5. Access keys — printed ONCE, save immediately somewhere safe ---------
aws iam create-access-key --user-name "${STACK_NAME}-deployer"
```

Then set those keys up as a named profile (not your default — keeps root/
personal credentials untouched):

```bash
aws configure --profile buildflow-deploy
# AccessKeyId / SecretAccessKey from step 5, region = $AWS_REGION, output = json
```

From then on, every deploy uses that profile and passes the execution role
explicitly — never root, never an admin identity:

```bash
cd backend
sam build
sam deploy --guided \
  --profile buildflow-deploy \
  --stack-name buildflow-backend \
  --s3-bucket buildflow-backend-sam-artifacts \
  --role-arn arn:aws:iam::<ACCOUNT_ID>:role/buildflow-backend-cfn-exec-role \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides DatabaseUrl='postgres://...:6543/postgres?sslmode=require'
```

`--guided` saves all of the above (profile, role-arn, bucket, capabilities)
into `samconfig.toml` — later deploys just need `sam deploy --profile buildflow-deploy`.

**After this bootstrap**, treat the root account like a fire extinguisher:
behind glass, used only to rotate/replace these credentials if the deploy
user's keys are ever compromised — not for routine deploys.
