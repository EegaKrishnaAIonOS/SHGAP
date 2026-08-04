# T24/ADR-0033: real AWS Secrets Manager entries for every secret this
# platform's own code already reads from an env var — `PII_ENCRYPTION_KEY`
# (ADR-0031), JWT signing secrets, and the DATABASE_URL/REDIS_URL this
# module's caller wires from the database/cache modules' own outputs. No
# provider credentials (MSG91/WhatsApp/Exotel/SES/Groq/Sarvam) are set here
# with real values — same "no fabricated secret" rule this project has
# followed for every other integration; a real rollout's operator pastes
# real values into these Secret resources via `aws secretsmanager
# put-secret-value` (or the console), never into a committed .tfvars file.

resource "random_password" "jwt_access_secret" {
  length = 64
}

resource "random_password" "jwt_refresh_secret" {
  length = 64
}

resource "random_password" "pii_encryption_key" {
  length  = 64
  special = false # PiiEncryptionService (ADR-0031) treats this as an opaque pgcrypto passphrase — alnum avoids any shell/env-var quoting surprise.
}

resource "aws_secretsmanager_secret" "core_api" {
  name = "${var.project_name}/${var.environment}/core-api"
}

resource "aws_secretsmanager_secret_version" "core_api" {
  secret_id = aws_secretsmanager_secret.core_api.id
  secret_string = jsonencode({
    DATABASE_URL       = var.database_url
    REDIS_URL          = var.redis_url
    JWT_ACCESS_SECRET  = random_password.jwt_access_secret.result
    JWT_REFRESH_SECRET = random_password.jwt_refresh_secret.result
    PII_ENCRYPTION_KEY = random_password.pii_encryption_key.result
  })
}

resource "aws_secretsmanager_secret" "notification_service" {
  name = "${var.project_name}/${var.environment}/notification-service"
}

resource "aws_secretsmanager_secret_version" "notification_service" {
  secret_id = aws_secretsmanager_secret.notification_service.id
  # Provider credentials start empty — every channel falls back to its
  # console/dev-stub provider (ADR-0011/ADR-0022) until an operator fills
  # these in for real, exactly like this repo's own .env.example does for
  # local dev. Terraform's job is to create the Secret, not populate it
  # with values nobody has handed it.
  secret_string = jsonencode({
    DATABASE_URL             = var.database_url
    REDIS_URL                = var.redis_url
    MSG91_AUTH_KEY           = ""
    MSG91_SENDER_ID          = ""
    WHATSAPP_ACCESS_TOKEN    = ""
    WHATSAPP_PHONE_NUMBER_ID = ""
    EXOTEL_ACCOUNT_SID       = ""
    EXOTEL_API_KEY           = ""
    EXOTEL_API_TOKEN         = ""
    EXOTEL_CALLER_ID         = ""
    EXOTEL_VOICE_APPLET_URL  = ""
    AWS_SES_REGION           = ""
    SES_FROM_EMAIL           = ""
  })

  lifecycle {
    # An operator's real credential updates (via console/CLI) must never be
    # clobbered back to blank by a routine `terraform apply` — Terraform
    # provisions the Secret's existence, not its ongoing real-world content.
    ignore_changes = [secret_string]
  }
}

resource "aws_secretsmanager_secret" "voice_service" {
  name = "${var.project_name}/${var.environment}/voice-service"
}

resource "aws_secretsmanager_secret_version" "voice_service" {
  secret_id = aws_secretsmanager_secret.voice_service.id
  secret_string = jsonencode({
    REDIS_URL      = var.redis_url
    GROQ_API_KEY   = ""
    SARVAM_API_KEY = ""
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}
