terraform {
  backend "s3" {
    bucket = "an-app-terraform-state"
    key    = "infra/terraform.tfstate"
    region = "ap-south-1"
    encrypt = true
  }
}
