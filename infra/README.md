# Terraform AWS Infrastructure


This config provisions:
- EKS cluster (Kubernetes)
- RDS PostgreSQL database (private, encrypted, password managed by RDS in
  Secrets Manager)
- IAM roles, VPC, networking

## Requirements

- Terraform 1.11 or newer (S3 native state locking)
- AWS CLI and jq

## Remote state and locking

State is stored in the S3 bucket `an-app-terraform-state` (key
`infra/terraform.tfstate`, region `ap-south-1`), encrypted at rest, and
locked with `use_lockfile = true`. During `plan` and `apply` Terraform holds
`infra/terraform.tfstate.tflock` next to the state, so a second concurrent
run fails to get the lock instead of overwriting the state. No DynamoDB table
is needed; DynamoDB locking is deprecated.

Terraform state contains secrets and resource details. Never commit it: the
repository `.gitignore` excludes `*.tfstate` and `*.tfstate.*` in every
directory. Always run Terraform from this `infra/` directory, not from the
repository root.

### Create the state bucket (once per account)

The bucket must exist before `terraform init`, so this configuration cannot
manage it. If it already exists, compare its settings with these commands.

```sh
BUCKET=an-app-terraform-state
REGION=ap-south-1

aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
  --create-bucket-configuration LocationConstraint="$REGION"

# Keep old state versions so a bad apply can be rolled back.
aws s3api put-bucket-versioning --bucket "$BUCKET" \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-encryption --bucket "$BUCKET" \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"aws:kms"},"BucketKeyEnabled":true}]}'

aws s3api put-public-access-block --bucket "$BUCKET" \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# Refuse any request that is not over TLS.
aws s3api put-bucket-policy --bucket "$BUCKET" --policy "{
  \"Version\": \"2012-10-17\",
  \"Statement\": [{
    \"Sid\": \"DenyInsecureTransport\",
    \"Effect\": \"Deny\",
    \"Principal\": \"*\",
    \"Action\": \"s3:*\",
    \"Resource\": [\"arn:aws:s3:::$BUCKET\", \"arn:aws:s3:::$BUCKET/*\"],
    \"Condition\": {\"Bool\": {\"aws:SecureTransport\": \"false\"}}
  }]
}"
```

Whoever runs Terraform needs `s3:ListBucket` on the bucket, `s3:GetObject`
and `s3:PutObject` on `infra/terraform.tfstate`, and `s3:GetObject`,
`s3:PutObject` and `s3:DeleteObject` on `infra/terraform.tfstate.tflock`.

## Usage

1. Install Terraform and the AWS CLI
2. Configure your AWS credentials (`aws configure`)
3. Run:
   ```sh
   terraform init
   terraform plan -out tfplan
   terraform apply tfplan
   rm tfplan
   ```

   A saved plan contains a full copy of the state, including sensitive
   values such as the EKS auth token, so treat it like the state file.
   `.gitignore` excludes `tfplan` and `*.tfplan` in every directory.

`.terraform.lock.hcl` is committed and holds provider hashes for
`linux_amd64` and `darwin_arm64`. If you add or upgrade a provider,
regenerate it with:

```sh
terraform providers lock -platform=linux_amd64 -platform=darwin_arm64
```

## Destroy

`terraform destroy` keeps a final RDS snapshot named
`<cluster_name>-postgres-final-<UTC time the instance was created>`. Each
instance gets its own name, so destroying a recreated instance does not
fail on an existing snapshot. The snapshots are kept, and billed, until
you delete them:

```sh
aws rds describe-db-snapshots --region ap-south-1 --snapshot-type manual \
  --query 'DBSnapshots[?starts_with(DBSnapshotIdentifier, `guestbook-eks-postgres-final-`)].[DBSnapshotIdentifier,SnapshotCreateTime]' \
  --output table
aws rds delete-db-snapshot --region ap-south-1 \
  --db-snapshot-identifier <snapshot name>
```
