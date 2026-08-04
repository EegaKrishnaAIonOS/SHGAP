output "product_images_bucket" {
  value = aws_s3_bucket.product_images.bucket
}

output "db_backups_bucket" {
  value = aws_s3_bucket.db_backups.bucket
}
