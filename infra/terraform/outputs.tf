output "cluster_identifier" {
  description = "The Aurora cluster identifier"
  value       = aws_rds_cluster.aurora.id
}

output "cluster_region" {
  description = "The AWS Region"
  value       = var.aws_region
}

output "cluster_endpoint" {
  description = "The Aurora cluster primary endpoint"
  value       = aws_rds_cluster.aurora.endpoint
}

output "proxy_endpoint" {
  description = "The RDS Proxy endpoint for pooled connections"
  value       = aws_db_proxy.aurora_proxy.endpoint
}

output "min_capacity" {
  description = "Configured minimum ACU"
  value       = var.min_capacity
}

output "max_capacity" {
  description = "Configured maximum ACU"
  value       = var.max_capacity
}

output "database_url_template" {
  description = "Prisma connection string format"
  value       = "postgresql://${var.master_username}:<PASSWORD>@${aws_rds_cluster.aurora.endpoint}:5432/${var.database_name}?schema=public&sslmode=require"
}
