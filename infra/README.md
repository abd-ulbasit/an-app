# Terraform AWS Infrastructure


This config provisions:
- EKS cluster (Kubernetes)
- RDS PostgreSQL database
- IAM roles, VPC, networking

## Usage

1. Install Terraform and AWS CLI
2. Configure your AWS credentials (`aws configure`)
3. Run:
   ```sh
   terraform init
   terraform apply
   ```
