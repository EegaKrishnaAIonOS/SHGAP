# T24/ADR-0033: one RDS Postgres instance running PostGIS + pgvector as
# regular RDS-supported extensions, not three separate data stores — the
# same real, already-made call ADR-0004 documented ("tripling operational
# surface for a pilot this size" was the reason to reject splitting them).
# This module is that decision's cloud-infra expression, not a new one.

resource "random_password" "master" {
  length  = 32
  special = false # RDS's master password field rejects some special chars; alnum is plenty of entropy at this length.
}

resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-db"
  subnet_ids = var.private_subnet_ids
}

resource "aws_db_parameter_group" "main" {
  name   = "${var.project_name}-postgres17"
  family = "postgres17"

  # PostGIS + pgvector both ship as real RDS-supported extensions on
  # Postgres 15+ — `rds.allowed_extensions` (or the shared_preload_libraries
  # equivalent some RDS versions require) makes CREATE EXTENSION possible;
  # the actual `CREATE EXTENSION postgis; CREATE EXTENSION vector;`
  # statements still run once via Prisma's own migration (see
  # database/prisma/migrations/*postgis*, *pgvector*), not here — Terraform
  # provisions the instance, it doesn't own the schema.
  parameter {
    name  = "shared_preload_libraries"
    value = "pg_stat_statements"
  }
}

resource "aws_db_instance" "main" {
  identifier     = "${var.project_name}-${var.environment}"
  engine         = "postgres"
  engine_version = "17.2"
  instance_class = var.instance_class

  allocated_storage = var.allocated_storage_gb
  storage_type      = "gp3"
  storage_encrypted = true

  db_name  = "shgap"
  username = "shgap"
  password = random_password.master.result

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [var.database_security_group_id]
  parameter_group_name   = aws_db_parameter_group.main.name

  multi_az = var.environment == "production"

  # Real backup/DR settings, not placeholders — ties directly into this
  # task's "set up ... backups" requirement. `pg_dump`-based logical backups
  # (infra/scripts/backup-postgres.sh) are the day-to-day, restore-tested
  # mechanism (see docs/runbooks/backup-restore.md); these RDS-native
  # snapshots are the point-in-time-recovery safety net underneath that,
  # not a replacement for it.
  backup_retention_period   = 7
  backup_window             = "18:00-19:00" # UTC — ~23:30-00:30 IST, this pilot's real low-traffic window
  maintenance_window        = "sun:19:00-sun:21:00"
  copy_tags_to_snapshot     = true
  deletion_protection       = var.environment == "production"
  skip_final_snapshot       = var.environment != "production"
  final_snapshot_identifier = var.environment == "production" ? "${var.project_name}-final-snapshot" : null

  performance_insights_enabled = true

  tags = { Name = "${var.project_name}-${var.environment}-db" }
}
