terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# -----------------------------------------------------------------------------
# 1. Random Password for Master Database User
# -----------------------------------------------------------------------------
resource "random_password" "db_master_password" {
  length           = 24
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# -----------------------------------------------------------------------------
# 2. VPC & Subnet Groups (Hyderabad ap-south-2)
# -----------------------------------------------------------------------------
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

resource "aws_db_subnet_group" "aurora" {
  name        = "${var.cluster_identifier}-subnet-group"
  description = "Subnet group for BrowserPilot Aurora Serverless v2"
  subnet_ids  = data.aws_subnets.default.ids

  tags = {
    Name        = "${var.cluster_identifier}-subnet-group"
    Environment = "production"
    Project     = "browserpilot"
  }
}

# -----------------------------------------------------------------------------
# 3. Security Group (Restricted Inbound)
# -----------------------------------------------------------------------------
resource "aws_security_group" "aurora_sg" {
  name        = "${var.cluster_identifier}-sg"
  description = "Security group for BrowserPilot Aurora Serverless v2 PostgreSQL cluster"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "PostgreSQL access from allowed application hosting or client IP range"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidr_blocks
  }

  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.cluster_identifier}-sg"
    Environment = "production"
    Project     = "browserpilot"
  }
}

# -----------------------------------------------------------------------------
# 4. Aurora Serverless v2 PostgreSQL Cluster
# -----------------------------------------------------------------------------
resource "aws_rds_cluster" "aurora" {
  cluster_identifier      = var.cluster_identifier
  engine                  = "aurora-postgresql"
  engine_mode             = "provisioned"
  engine_version          = var.postgres_engine_version
  database_name           = var.database_name
  master_username         = var.master_username
  master_password         = random_password.db_master_password.result
  db_subnet_group_name    = aws_db_subnet_group.aurora.name
  vpc_security_group_ids  = [aws_security_group.aurora_sg.id]
  backup_retention_period = 1 # Automatic 1-day retention constraint
  skip_final_snapshot     = true
  deletion_protection     = false

  serverlessv2_scaling_configuration {
    min_capacity = var.min_capacity # 0.5 ACU
    max_capacity = var.max_capacity # 4.0 ACU
  }

  tags = {
    Name        = var.cluster_identifier
    Environment = "production"
    Project     = "browserpilot"
  }
}

# Single-AZ instance constraint (do not create multi-AZ replica to conserve credit)
resource "aws_rds_cluster_instance" "aurora_instance" {
  identifier           = "${var.cluster_identifier}-instance-1"
  cluster_identifier   = aws_rds_cluster.aurora.id
  instance_class       = "db.serverless"
  engine               = aws_rds_cluster.aurora.engine
  engine_version       = aws_rds_cluster.aurora.engine_version
  db_subnet_group_name = aws_db_subnet_group.aurora.name
  publicly_accessible  = true # Allows secure verification and migration passes from authorized CIDR

  tags = {
    Name        = "${var.cluster_identifier}-instance-1"
    Environment = "production"
    Project     = "browserpilot"
  }
}

# -----------------------------------------------------------------------------
# 5. AWS Secrets Manager (Required for RDS Proxy)
# -----------------------------------------------------------------------------
resource "aws_secretsmanager_secret" "db_credentials" {
  name                    = "${var.cluster_identifier}-master-credentials"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username = var.master_username
    password = random_password.db_master_password.result
    engine   = "postgres"
    host     = aws_rds_cluster.aurora.endpoint
    port     = 5432
    dbClusterIdentifier = aws_rds_cluster.aurora.id
  })
}

# -----------------------------------------------------------------------------
# 6. IAM Role for RDS Proxy
# -----------------------------------------------------------------------------
resource "aws_iam_role" "rds_proxy_role" {
  name = "${var.cluster_identifier}-proxy-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "rds.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "rds_proxy_policy" {
  name = "${var.cluster_identifier}-proxy-policy"
  role = aws_iam_role.rds_proxy_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "secretsmanager:GetSecretValue"
        Resource = aws_secretsmanager_secret.db_credentials.arn
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# 7. RDS Proxy (Connection Pooling)
# -----------------------------------------------------------------------------
resource "aws_db_proxy" "aurora_proxy" {
  name                   = "${var.cluster_identifier}-proxy"
  debug_logging          = false
  engine_family          = "POSTGRESQL"
  idle_client_timeout    = 1800
  require_tls            = true
  role_arn               = aws_iam_role.rds_proxy_role.arn
  vpc_security_group_ids = [aws_security_group.aurora_sg.id]
  vpc_subnet_ids         = data.aws_subnets.default.ids

  auth {
    auth_scheme = "SECRETS"
    iam_auth    = "DISABLED"
    secret_arn  = aws_secretsmanager_secret.db_credentials.arn
  }

  tags = {
    Name        = "${var.cluster_identifier}-proxy"
    Environment = "production"
    Project     = "browserpilot"
  }

  depends_on = [
    aws_secretsmanager_secret_version.db_credentials
  ]
}

resource "aws_db_proxy_default_target_group" "aurora_proxy_target_group" {
  db_proxy_name = aws_db_proxy.aurora_proxy.name

  connection_pool_config {
    connection_borrow_timeout    = 120
    max_connections_percent      = 100
    max_idle_connections_percent = 50
  }
}

resource "aws_db_proxy_target" "aurora_proxy_target" {
  db_proxy_name         = aws_db_proxy.aurora_proxy.name
  target_group_name     = aws_db_proxy_default_target_group.aurora_proxy_target_group.name
  db_cluster_identifier = aws_rds_cluster.aurora.id
}
