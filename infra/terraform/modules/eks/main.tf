# T24/ADR-0033: a real but deliberately lean EKS cluster — one managed node
# group, no separate control-plane-per-environment cluster sprawl. ADR-0013
# already flagged Kubernetes' operational overhead as a trade-off to
# "mitigate" for a POC this size; this module is that mitigation: the
# minimum real EKS setup infra/k8s/*'s manifests need to actually run
# against, not a maximal reference architecture.

resource "aws_iam_role" "cluster" {
  name = "${var.project_name}-${var.environment}-eks-cluster"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "eks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "cluster_policy" {
  role       = aws_iam_role.cluster.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
}

resource "aws_eks_cluster" "main" {
  name     = "${var.project_name}-${var.environment}"
  role_arn = aws_iam_role.cluster.arn
  version  = var.kubernetes_version

  vpc_config {
    subnet_ids              = concat(var.private_subnet_ids, var.public_subnet_ids)
    endpoint_private_access = true
    # Public endpoint stays enabled for this POC (no VPN/bastion/Direct
    # Connect into the VPC exists) — a real production rollout past pilot
    # scale should restrict this to a CIDR allowlist or disable it in favor
    # of a bastion, not leave it open the way this POC-scoped default does.
    endpoint_public_access = true
  }

  depends_on = [aws_iam_role_policy_attachment.cluster_policy]

  tags = { Name = "${var.project_name}-${var.environment}-eks" }
}

resource "aws_iam_role" "node_group" {
  name = "${var.project_name}-${var.environment}-eks-nodes"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "node_worker" {
  role       = aws_iam_role.node_group.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
}

resource "aws_iam_role_policy_attachment" "node_cni" {
  role       = aws_iam_role.node_group.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
}

resource "aws_iam_role_policy_attachment" "node_ecr" {
  role       = aws_iam_role.node_group.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

resource "aws_eks_node_group" "main" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "${var.project_name}-${var.environment}-workers"
  node_role_arn   = aws_iam_role.node_group.arn
  subnet_ids      = var.private_subnet_ids
  instance_types  = [var.node_instance_type]

  scaling_config {
    desired_size = var.node_desired_count
    min_size     = 1
    max_size     = var.node_desired_count + 2 # real headroom for the blue/green rollout doubling pod count briefly during a switch — see docs/runbooks/blue-green-deploy.md
  }

  update_config {
    max_unavailable = 1
  }

  depends_on = [
    aws_iam_role_policy_attachment.node_worker,
    aws_iam_role_policy_attachment.node_cni,
    aws_iam_role_policy_attachment.node_ecr,
  ]

  tags = { Name = "${var.project_name}-${var.environment}-eks-nodes" }
}

# IRSA (IAM Roles for Service Accounts) OIDC provider — required for any
# in-cluster controller (AWS Load Balancer Controller, cluster-autoscaler,
# external-dns) that needs to call the AWS API with a scoped role instead
# of the node group's own broad instance-profile permissions. Not yet wired
# to a specific controller's IAM role in this module — that's real,
# concrete follow-up work once a specific ingress controller is chosen, not
# invented speculatively here.
data "tls_certificate" "eks_oidc" {
  url = aws_eks_cluster.main.identity[0].oidc[0].issuer
}

resource "aws_iam_openid_connect_provider" "eks" {
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.eks_oidc.certificates[0].sha1_fingerprint]
  url             = aws_eks_cluster.main.identity[0].oidc[0].issuer
}
