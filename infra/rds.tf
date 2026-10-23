resource "aws_db_instance" "postgres" {
  allocated_storage = 20
  engine            = "postgres"
  # Major version only: RDS picks the current 17.x minor and applies minor
  # upgrades in the maintenance window. PostgreSQL 13 left RDS standard
  # support on 28 Feb 2026 (Extended Support charges); 17 is supported until
  # Feb 2030. PG 15+ enforces TLS by default (rds.force_ssl=1); the k8s
  # clients use sslmode=verify-full.
  engine_version       = "17"
  instance_class       = "db.t3.micro"
  db_name              = var.db_name
  username             = var.db_username
  parameter_group_name = "default.postgres17"

  # RDS generates the master password and keeps it in Secrets Manager. No
  # password is in code, variables, plan output or Terraform state.
  # Secrets Manager rotates it every 7 days by default, see
  # docs/adr/0001-database-credentials.md for what that means for the app.
  manage_master_user_password = true

  storage_encrypted   = true # AWS-managed aws/rds KMS key
  publicly_accessible = false

  # Keep a final snapshot on destroy so `terraform destroy` cannot silently
  # delete the data. Delete the snapshot by hand when it is no longer needed.
  skip_final_snapshot       = false
  final_snapshot_identifier = "${var.cluster_name}-postgres-final"
  backup_retention_period   = 7
  copy_tags_to_snapshot     = true

  vpc_security_group_ids = [aws_security_group.db_sg.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name
}

resource "aws_db_subnet_group" "main" {
  name       = "main-db-subnet-group"
  subnet_ids = aws_subnet.main[*].id
}

resource "aws_security_group" "db_sg" {
  description = "PostgreSQL from the EKS cluster only"
  vpc_id      = aws_vpc.main.id

  # Only the EKS cluster security group may connect. Managed node groups
  # without a launch template use this group, so it covers the nodes and the
  # pods on them (VPC CNI without security groups for pods).
  ingress {
    description     = "PostgreSQL from EKS nodes and pods"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_eks_cluster.main.vpc_config[0].cluster_security_group_id]
  }

  # No egress rules: RDS does not open outbound connections, and security
  # groups are stateful, so replies to allowed inbound traffic still flow.
  # Terraform removes AWS's default allow-all egress rule when none is set.
}
