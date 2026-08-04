# T24/ADR-0033: `aws` is the concrete provider this module set is written
# against — AWS's `ap-south-1` (Mumbai) is a literal India region, and AWS's
# Terraform provider is the most exhaustively documented, which matters for
# a POC nobody has run against real infra yet. ADR-0013 requires an actual
# MeitY-empanelled cloud for a production rollout (this pilot's own
# government sponsor's compliance requirement, not this repo's to decide) —
# swapping the `aws` provider block in versions.tf and the resource types in
# each modules/* directory for whichever empanelled CSP's Terraform provider
# is mandated is exactly the portability Terraform was chosen for (ADR-0013's
# own reasoning), not a rewrite of this file tree's structure.

variable "aws_region" {
  description = "AWS region — ap-south-1 (Mumbai) is this module set's literal India-region target."
  type        = string
  default     = "ap-south-1"
}

variable "environment" {
  description = "Deployment environment name, used for resource naming/tagging (e.g. staging, production)."
  type        = string
  default     = "staging"
}

variable "project_name" {
  description = "Short project name used as a resource-naming prefix."
  type        = string
  default     = "shgap"
}

variable "db_instance_class" {
  description = "RDS instance class — small by default, matching this POC's real scale (ADR-0004's own 'don't over-provision for a 90-day pilot' reasoning)."
  type        = string
  default     = "db.t4g.medium"
}

variable "db_allocated_storage_gb" {
  type    = number
  default = 50
}

variable "redis_node_type" {
  type    = string
  default = "cache.t4g.micro"
}

variable "eks_node_instance_type" {
  type    = string
  default = "t3.medium"
}

variable "eks_node_desired_count" {
  type    = number
  default = 2
}

variable "eks_kubernetes_version" {
  type    = string
  default = "1.31"
}

variable "vpc_cidr" {
  type    = string
  default = "10.20.0.0/16"
}

variable "availability_zone_count" {
  description = "Number of AZs to spread subnets across. 2 is the real minimum RDS Multi-AZ and EKS both need — not a POC shortcut."
  type        = number
  default     = 2
}
