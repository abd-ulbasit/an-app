# CI access to AWS through GitHub OIDC

The `CI/CD Pipeline` workflow does not use stored AWS access keys. Each run
asks GitHub for a short-lived OIDC token and exchanges it with AWS STS for
temporary credentials of one IAM role. That role can only push to the two
ECR repositories.

The workflow reads the role ARN from the repository **variable**
`AWS_ROLE_ARN` (Settings > Secrets and variables > Actions > Variables). It is
not a secret: a role ARN grants nothing on its own, because only tokens
issued by GitHub for this repository and branch can assume the role.

## One-time setup (account owner)

Replace `<ACCOUNT_ID>` with the AWS account ID.

1. Create the GitHub OIDC identity provider once per account, if it does not
   exist yet:

   ```sh
   aws iam create-open-id-connect-provider \
     --url https://token.actions.githubusercontent.com \
     --client-id-list sts.amazonaws.com
   ```

2. Create the role `an-app-github-ci` with this trust policy. The `sub`
   condition limits it to workflow runs on `main` of this repository, so
   forks, pull requests and other branches cannot assume it:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Principal": {
           "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
         },
         "Action": "sts:AssumeRoleWithWebIdentity",
         "Condition": {
           "StringEquals": {
             "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
             "token.actions.githubusercontent.com:sub": "repo:abd-ulbasit/an-app:ref:refs/heads/main"
           }
         }
       }
     ]
   }
   ```

   This repository was created on 2025-08-30, so GitHub issues the classic
   `repo:OWNER/REPO:...` subject. Repositories created, renamed or
   transferred after 15 July 2026 get the immutable form
   `repo:OWNER@OWNER_ID/REPO@REPO_ID:...` (here
   `repo:abd-ulbasit@90849025/an-app@1047349733:ref:refs/heads/main`). If
   this repository is ever renamed or transferred, update the condition.

3. Attach this permissions policy (push to the two repositories only):

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "EcrLogin",
         "Effect": "Allow",
         "Action": "ecr:GetAuthorizationToken",
         "Resource": "*"
       },
       {
         "Sid": "EcrPush",
         "Effect": "Allow",
         "Action": [
           "ecr:BatchCheckLayerAvailability",
           "ecr:BatchGetImage",
           "ecr:CompleteLayerUpload",
           "ecr:InitiateLayerUpload",
           "ecr:PutImage",
           "ecr:UploadLayerPart"
         ],
         "Resource": [
           "arn:aws:ecr:ap-south-1:<ACCOUNT_ID>:repository/backend",
           "arn:aws:ecr:ap-south-1:<ACCOUNT_ID>:repository/frontend"
         ]
       }
     ]
   }
   ```

4. Set the repository variable `AWS_ROLE_ARN` to the role ARN.

5. Remove what the old pipeline needed: delete the repository secrets
   `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `ECR_BACKEND`,
   `ECR_FRONTEND`, `GH_PAT` and `GH_TOKEN`, then deactivate and delete the
   IAM access key that was stored there.

