variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "cache_security_group_id" {
  type = string
}

variable "node_type" {
  type = string
}
