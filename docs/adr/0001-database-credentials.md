# ADR 0001: Database credentials

- Status: Accepted (interim step done; automatic sync proposed)
- Date: 2026-10-23

## Problem

The RDS master password was a committed Terraform variable default. The same
plaintext value was in the backend Deployment, the db-init Job and
docker-compose.yml. `sensitive = true` only hid it in CLI output: it was
still in git, in every plan and in Terraform state. The value is in git
history permanently and must be treated as burned.

The app connects as the master user and reads `POSTGRES_PASSWORD` once, at
process start, from an environment variable.

## Options

1. **Terraform variable without a default** (`TF_VAR_db_password`). Removes
   the value from git, but it is still written to the plan and to state in
   S3, and nothing rotates it.
2. **RDS-managed master password, copied into a Kubernetes Secret by hand.**
   `manage_master_user_password = true`: RDS generates the password, stores
   it in Secrets Manager (encrypted with KMS) and rotates it. It is never in
   code, plan or state. An operator pipes it into `db-secret` with
   `kubectl create secret`. Downside: Secrets Manager rotates it every 7
   days by default and the Kubernetes copy does not follow, so new DB
   connections fail after a rotation until someone refreshes the Secret and
   restarts the backend.
3. **RDS-managed password synced by External Secrets Operator (ESO).** ESO
   reads the Secrets Manager secret through an IRSA role and keeps
   `db-secret` up to date (for example `refreshInterval: 1h`). The backend
   picks up the new value without manual steps.
4. **IAM database authentication for the app.** The backend gets a
   15-minute token from its IRSA role and has no password at all. It needs
   a dedicated DB role with `rds_iam` and token generation in the app
   (`@aws-sdk/rds-signer`). The master secret then only serves admin tasks
   such as the init Job.

## Decision

Option 2 now (implemented in this change). Option 3 is the next step.
Option 4 is a later improvement once a dedicated app role exists.

Option 2 removes the credential from code and state today with no new
cluster components, and it keeps a rotating secret as the source of truth.
The weekly refresh is a known, documented cost until option 3 lands. The
alternative of lengthening the rotation interval in Secrets Manager was
rejected: it trades away the main benefit to save an operator step.

## Migration to option 3

1. Install ESO with Helm, pinned to a chart version, in its own namespace.
2. Create an IRSA role for the ESO service account that allows
   `secretsmanager:GetSecretValue` and `secretsmanager:DescribeSecret` on
   the `rds_master_user_secret_arn` output only (plus `kms:Decrypt` if a
   customer-managed key is used).
3. Add a `SecretStore` (provider `aws`, service `SecretsManager`, region
   `ap-south-1`) and an `ExternalSecret` named `db-secret` with
   `creationPolicy: Owner`. It maps the `password` property to
   `POSTGRES_PASSWORD` and sets `RDS_ENDPOINT` through the target template,
   or a ConfigMap reference, because it is not a secret.
4. Make the backend follow rotation without a restart: mount `db-secret` as
   a volume and pass node-postgres a `password` function that reads the
   file for each new connection. Alternatively, add a controller such as
   Stakater Reloader to restart the Deployment when the Secret changes.
5. Once ESO owns `db-secret`, delete the hand-made Secret and remove the
   manual refresh step from `PROJECT_SETUP.md` and `k8s/setup.md`.
   `k8s/argocd-app.yaml` already excludes `*secret*.yaml`, so the
   `ExternalSecret` manifest needs a name that does not match that pattern
   (for example `db-credentials-external.yaml`), or the exclude needs
   narrowing.
6. Follow-up hardening: create a least-privilege `guestbook_app` role that
   owns only the `entries` table and point the backend at it. Keep the
   master user for the init Job.
