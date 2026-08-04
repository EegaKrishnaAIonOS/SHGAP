output "core_api_secret_arn" {
  value = aws_secretsmanager_secret.core_api.arn
}

output "notification_service_secret_arn" {
  value = aws_secretsmanager_secret.notification_service.arn
}

output "voice_service_secret_arn" {
  value = aws_secretsmanager_secret.voice_service.arn
}
