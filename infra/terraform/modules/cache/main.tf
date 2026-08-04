# T24/ADR-0033: single-node ElastiCache Redis, no cluster-mode/replication —
# matches this POC's real usage (OTP codes, sessions, BullMQ queues; nothing
# that needs Redis-level HA to stay within the sprint plan's own uptime
# target, which is measured at the application layer, not per-dependency).
# A production rollout past pilot scale is the natural point to revisit
# this, not something to over-build now.

resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.project_name}-cache"
  subnet_ids = var.private_subnet_ids
}

resource "aws_elasticache_cluster" "main" {
  cluster_id         = "${var.project_name}-${var.environment}"
  engine             = "redis"
  engine_version     = "7.1"
  node_type          = var.node_type
  num_cache_nodes    = 1
  port               = 6379
  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [var.cache_security_group_id]

  snapshot_retention_limit = 1 # BullMQ jobs/OTP codes/sessions are all short-lived and re-creatable — a real snapshot exists, but isn't the primary backup story the way Postgres's is.

  tags = { Name = "${var.project_name}-${var.environment}-cache" }
}
