# Project Setup Instructions

## Prerequisites
- AWS CLI
- Docker
- kubectl
- Terraform
- Ansible
- ArgoCD CLI (optional, for local sync)

## First-Time Setup Steps

1. **Clone the repository**
   ```sh
   git clone https://github.com/abd-ulbasit/an-app.git
   cd an-app
   ```

2. **Configure AWS credentials**
   - Set up your AWS CLI with `aws configure`.
   - Ensure your IAM user has permissions for ECR, EKS, RDS, S3, etc.

3. **Provision infrastructure with Terraform**
   ```sh
   cd infra
   terraform init
   terraform apply
   ```

4. **Install ArgoCD using Ansible**
   ```sh
   ansible-playbook ansible/install-argocd.yaml
   ```

5. **Build and push Docker images (if not using CI/CD)**
   ```sh
   docker build -t <ECR_BACKEND>:latest ./backend
   docker build -t <ECR_FRONTEND>:latest ./frontend
   aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <account>.dkr.ecr.<region>.amazonaws.com
   docker push <ECR_BACKEND>:latest
   docker push <ECR_FRONTEND>:latest
   ```

6. **Create Kubernetes secret for DB URL**
   ```sh
   kubectl apply -f k8s/db-secret.yaml
   ```

7. **Apply/sync manifests with ArgoCD**
   - Port-forward ArgoCD server:
     ```sh
     kubectl port-forward svc/argocd-server -n argocd 8080:443
     ```
   - Login to ArgoCD CLI:
     ```sh
     argocd login localhost:8080 --username admin --password <password> --insecure
     argocd app sync guestbook-app
     ```

8. **Verify deployment**
   ```sh
   kubectl get pods
   kubectl get svc
   ```

## Notes
- Do NOT commit `k8s/db-secret.yaml` to git (it's in .gitignore).
- CI/CD pipeline will automate image build/push if configured.
- For ArgoCD API sync from CI/CD, expose ArgoCD server via LoadBalancer/Ingress and use an API token.
