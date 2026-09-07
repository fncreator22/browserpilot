variable "aws_region" {
  description = "Target AWS Region"
  type        = string
  default     = "ap-south-2" # Hyderabad
}

variable "cluster_identifier" {
  description = "Unique Aurora cluster identifier"
  type        = string
  default     = "browserpilot-prod-aurora"
}

variable "database_name" {
  description = "Initial production database name"
  type        = string
  default     = "browserpilot"
}

variable "master_username" {
  description = "Master database user"
  type        = string
  default     = "postgres"
}

variable "postgres_engine_version" {
  description = "Aurora PostgreSQL engine version"
  type        = string
  default     = "16.8"
}

variable "min_capacity" {
  description = "Minimum Serverless v2 capacity in ACUs (0.5 ACU constraint)"
  type        = number
  default     = 0.5
}

variable "max_capacity" {
  description = "Maximum Serverless v2 capacity in ACUs (4.0 ACU constraint)"
  type        = number
  default     = 4.0
}

variable "allowed_cidr_blocks" {
  description = "Inbound CIDR blocks allowed to access the database and proxy"
  type        = list(string)
  default     = ["106.222.230.246/32", "172.31.0.0/16"] # Developer machine IP + VPC default CIDR
}
