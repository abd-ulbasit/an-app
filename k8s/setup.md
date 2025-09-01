# Setup steps after first terraform apply

```sh
# 1. Setup ECR and update deployment files with image URIs
aws ecr describe-repositories --repository-names frontend --query "repositories[0].repositoryUri" --output text

# 2. Update kubeconfig for EKS
aws eks update-kubeconfig --region ap-south-1 --name guestbook-eks

# 3. Install AWS Load Balancer Controller (ALB) with Helm
helm repo add eks https://aws.github.io/eks-charts
helm repo update
helm upgrade --install aws-load-balancer-controller eks/aws-load-balancer-controller \
  --namespace kube-system \
  --set clusterName=guestbook-eks \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller \
  --set region=ap-south-1 \
  --set vpcId=vpc-097ab8f9d8835d12c

# 4. Install ArgoCD using Ansible
ansible-playbook ansible/install-argocd.yaml

# 5. Get ArgoCD admin password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d

# 6. Port-forward ArgoCD server
kubectl port-forward svc/argocd-server -n argocd 8080:443

# 7. Login to ArgoCD
argocd login localhost:8080 --username admin --password {PASSWORD} --insecure

# update the rds endpoint in db-secret.yaml from terraform output

# 8. Apply db-secret (only if not managed by ArgoCD)
kubectl apply -f k8s/db-secret.yaml

# 9. Apply ArgoCD app manifest
kubectl apply -f k8s/argocd-app.yaml



# 10. Sync ArgoCD app
argocd app sync guestbook
```

# 11. Initialize the database schema in RDS
kubectl apply -f k8s/db-init-sql-configmap.yaml
kubectl apply -f k8s/db-init-job.yaml
# (This will create the 'entries' table in your RDS instance)

---

## Automating kubeconfig update with Terraform

You can automate the kubeconfig update step after EKS cluster creation using a Terraform `null_resource` and `local-exec` provisioner:

```hcl
resource "null_resource" "update_kubeconfig" {
	provisioner "local-exec" {
		command = "aws eks update-kubeconfig --region ap-south-1 --name ${var.cluster_name}"
	}

	triggers = {
		cluster_id = aws_eks_cluster.main.id
	}
}
```

Add this resource to your Terraform code. After the EKS cluster is created, Terraform will automatically run the kubeconfig update command.