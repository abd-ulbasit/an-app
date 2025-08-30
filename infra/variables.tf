variable "cluster_name" {
  description = "EKS cluster name"
  type        = string
  default     = "guestbook-eks"
}

variable "db_name" {
  description = "RDS database name"
  type        = string
  default     = "guestbook"
}

variable "db_username" {
  description = "RDS master username"
  type        = string
  default     = "postgres"
}

variable "db_password" {
  description = "RDS master password"
  type        = string
  default     = "postgres123"
  sensitive   = true
}
