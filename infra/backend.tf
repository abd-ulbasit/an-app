terraform {
  # State lives in a bucket created outside this configuration (see
  # README.md). use_lockfile enables S3-native state locking (GA in
  # Terraform 1.11): Terraform takes a lock object next to the state with a
  # conditional write, so two concurrent plan/apply runs cannot corrupt the
  # state. DynamoDB-based locking is deprecated and not needed.
  backend "s3" {
    bucket       = "an-app-terraform-state"
    key          = "infra/terraform.tfstate"
    region       = "ap-south-1"
    encrypt      = true
    use_lockfile = true
  }
}
