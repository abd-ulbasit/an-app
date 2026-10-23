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

# 8. Create db-secret. It is not in git and Argo CD does not manage it.
#    The RDS master password lives in Secrets Manager (RDS-managed); it is
#    piped straight into the Secret, never into a variable, file or argv.
#    RDS_ENDPOINT is the hostname WITHOUT the :5432 suffix (rds_address).
#    Secrets Manager rotates the password every 7 days by default: after a
#    rotation, `kubectl delete secret db-secret`, rerun this, then
#    `kubectl rollout restart deployment/backend`
#    (docs/adr/0001-database-credentials.md).
aws secretsmanager get-secret-value \
    --secret-id "$(terraform -chdir=infra output -raw rds_master_user_secret_arn)" \
    --query SecretString --output text \
  | jq -j .password \
  | kubectl create secret generic db-secret \
      --from-literal=RDS_ENDPOINT="$(terraform -chdir=infra output -raw rds_address)" \
      --from-file=POSTGRES_PASSWORD=/dev/stdin

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