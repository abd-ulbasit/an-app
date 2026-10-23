output "eks_cluster_name" {
  value = aws_eks_cluster.main.name
}

output "vpc_id" {
  value = aws_vpc.main.id
}

output "rds_endpoint" {
  description = "RDS endpoint as host:port. Do not use this for RDS_ENDPOINT in db-secret; use rds_address."
  value       = aws_db_instance.postgres.endpoint
}

output "rds_address" {
  description = "RDS hostname without the port. This is the RDS_ENDPOINT value in the db-secret Kubernetes Secret."
  value       = aws_db_instance.postgres.address
}

output "rds_master_user_secret_arn" {
  description = "ARN of the Secrets Manager secret that holds the RDS master credentials (JSON with username and password)."
  value       = aws_db_instance.postgres.master_user_secret[0].secret_arn
}
