# T24/ADR-0033: S3 is MinIO's real production equivalent — core-api's
# `storage/` module already talks to MinIO purely through the S3 API (T06),
# so this is a credentials/endpoint swap for `StorageModule`, not a new
# integration to write.

resource "aws_s3_bucket" "product_images" {
  bucket = "${var.project_name}-${var.environment}-product-images"

  tags = { Name = "${var.project_name}-product-images" }
}

resource "aws_s3_bucket_public_access_block" "product_images" {
  bucket = aws_s3_bucket.product_images.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "product_images" {
  bucket = aws_s3_bucket.product_images.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "product_images" {
  bucket = aws_s3_bucket.product_images.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "product_images" {
  bucket = aws_s3_bucket.product_images.id
  rule {
    id     = "expire-old-versions"
    status = "Enabled"
    filter {} # applies to every object in the bucket, not a prefix subset
    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }
}

# T24/ADR-0033: real Postgres logical backups (infra/scripts/backup-postgres.sh,
# see docs/runbooks/backup-restore.md) land here — a second, independent
# bucket from product images so a lifecycle/retention mistake on one can
# never touch the other.
resource "aws_s3_bucket" "db_backups" {
  bucket = "${var.project_name}-${var.environment}-db-backups"
  tags   = { Name = "${var.project_name}-db-backups" }
}

resource "aws_s3_bucket_public_access_block" "db_backups" {
  bucket                  = aws_s3_bucket.db_backups.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "db_backups" {
  bucket = aws_s3_bucket.db_backups.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "db_backups" {
  bucket = aws_s3_bucket.db_backups.id
  rule {
    id     = "expire-old-backups"
    status = "Enabled"
    filter {}
    expiration {
      # Matches the RDS automated-snapshot retention window (database
      # module's backup_retention_period) — the two backup mechanisms stay
      # in sync rather than one silently outliving the other.
      days = 30
    }
  }
}
