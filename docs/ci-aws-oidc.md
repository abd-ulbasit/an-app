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

3. Attach this permissions policy (push to the two repositories only).
   `ecr:DescribeImages` lets the workflow see that a commit's image is
   already in ECR, so a re-run skips it instead of failing on the immutable
   tag (step 6):

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
           "ecr:DescribeImages",
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

5. Remove what the old pipeline needed. Deleting a repository secret does
   not invalidate the credential it held, so revoke the credentials first:

   1. Revoke the GitHub personal access token(s) that were stored in
      `GH_PAT` and `GH_TOKEN`, at <https://github.com/settings/tokens>
      (classic tokens) or
      <https://github.com/settings/personal-access-tokens> (fine-grained
      tokens). No workflow here needs a personal token.
   2. Deactivate and then delete the IAM access key that was stored in
      `AWS_ACCESS_KEY_ID` (IAM > Users > Security credentials).
   3. Delete the repository secrets `AWS_ACCESS_KEY_ID`,
      `AWS_SECRET_ACCESS_KEY`, `ECR_BACKEND`, `ECR_FRONTEND`, `GH_PAT` and
      `GH_TOKEN`.

6. Set both ECR repositories to immutable tags, so a pushed `<git sha>` tag
   can never be overwritten. A re-run of the workflow for the same commit
   still works: it keeps an image that is already in ECR and builds only
   the missing one.

   ```sh
   aws ecr put-image-tag-mutability --region ap-south-1 \
     --repository-name backend --image-tag-mutability IMMUTABLE
   aws ecr put-image-tag-mutability --region ap-south-1 \
     --repository-name frontend --image-tag-mutability IMMUTABLE
   ```

## Rules on `main` and the deploy push

The `update-manifests` job deploys by pushing the image-tag commit straight
to `main` with the workflow's `GITHUB_TOKEN`
(`git push origin HEAD:refs/heads/main`). Rules that block deleting `main`
or force-pushing to it are fine, because that push is a normal
fast-forward. A rule that requires pull requests, status checks or signed
commits on `main` rejects it: every deploy then fails at the "Commit and
push" step, after the images are already in ECR.

If you add such a rule, change the deploy path in the same step. Either:

- push with a dedicated GitHub App instead of `GITHUB_TOKEN` (for example
  through `actions/create-github-app-token`) and add that app to the
  ruleset's bypass list. A push made with an app token starts workflows,
  unlike one made with `GITHUB_TOKEN`; the `paths` filter in
  `ci-cd.yaml` already keeps the `k8s/`-only commit from rebuilding; or
- change `update-manifests` to open a pull request with the tag change and
  enable auto-merge, so the deploy passes the same rules as any other
  change. This needs `pull-requests: write` on that job, and "Allow
  auto-merge" and "Allow GitHub Actions to create and approve pull
  requests" in the repository settings. A pull request opened with
  `GITHUB_TOKEN` starts no workflows, so if the rule requires status
  checks, open it with a GitHub App token instead.
