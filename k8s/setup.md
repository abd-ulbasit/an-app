# Setup steps after first terraform apply

```sh
# 1. Setup ECR and update deployment files with image URIs
aws ecr describe-repositories --repository-names frontend --query "repositories[0].repositoryUri" --output text

# 2. Update kubeconfig for EKS
aws eks update-kubeconfig --region ap-south-1 --name guestbook-eks

# 3. Install ArgoCD using Ansible
ansible-playbook ansible/install-argocd.yaml

# 4. Get ArgoCD admin password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d

# 5. Port-forward ArgoCD server
kubectl port-forward svc/argocd-server -n argocd 8080:443

# 6. Login to ArgoCD
argocd login localhost:8080 --username admin --password {PASSWORD} --insecure

# 7. Apply ArgoCD app manifest
kubectl apply -f k8s/argocd-app.yaml

# 8. Apply db-secret (only if not managed by ArgoCD)
kubectl apply -f k8s/db-secret.yaml

# 9. Sync ArgoCD app
argocd app sync guestbook
```