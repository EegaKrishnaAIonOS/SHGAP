module "network" {
  source = "./modules/network"

  project_name            = var.project_name
  vpc_cidr                = var.vpc_cidr
  availability_zone_count = var.availability_zone_count
}

module "database" {
  source = "./modules/database"

  project_name               = var.project_name
  environment                = var.environment
  private_subnet_ids         = module.network.private_subnet_ids
  database_security_group_id = module.network.database_security_group_id
  instance_class             = var.db_instance_class
  allocated_storage_gb       = var.db_allocated_storage_gb
}

module "cache" {
  source = "./modules/cache"

  project_name            = var.project_name
  environment             = var.environment
  private_subnet_ids      = module.network.private_subnet_ids
  cache_security_group_id = module.network.cache_security_group_id
  node_type               = var.redis_node_type
}

module "storage" {
  source = "./modules/storage"

  project_name = var.project_name
  environment  = var.environment
}

module "eks" {
  source = "./modules/eks"

  project_name       = var.project_name
  environment        = var.environment
  private_subnet_ids = module.network.private_subnet_ids
  public_subnet_ids  = module.network.public_subnet_ids
  kubernetes_version = var.eks_kubernetes_version
  node_instance_type = var.eks_node_instance_type
  node_desired_count = var.eks_node_desired_count
}

module "secrets" {
  source = "./modules/secrets"

  project_name = var.project_name
  environment  = var.environment
  database_url = module.database.database_url
  redis_url    = module.cache.redis_url
}
