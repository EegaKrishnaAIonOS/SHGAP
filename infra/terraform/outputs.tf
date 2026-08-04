output "vpc_id" {
  value = module.network.vpc_id
}

output "eks_cluster_name" {
  value = module.eks.cluster_name
}

output "eks_cluster_endpoint" {
  value = module.eks.cluster_endpoint
}

output "database_endpoint" {
  value = module.database.endpoint
}

output "redis_url" {
  value = module.cache.redis_url
}

output "product_images_bucket" {
  value = module.storage.product_images_bucket
}

output "db_backups_bucket" {
  value = module.storage.db_backups_bucket
}

output "core_api_secret_arn" {
  value = module.secrets.core_api_secret_arn
}

output "notification_service_secret_arn" {
  value = module.secrets.notification_service_secret_arn
}

output "voice_service_secret_arn" {
  value = module.secrets.voice_service_secret_arn
}

output "configure_kubectl" {
  description = "Run this after apply to point kubectl at the new cluster."
  value       = "aws eks update-kubeconfig --region ${var.aws_region} --name ${module.eks.cluster_name}"
}
