# Project Setup Instructions

## Prerequisites
- AWS CLI and jq
- Docker
- kubectl
- Terraform 1.11 or newer
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

   The S3 state bucket must exist first; see [infra/README.md](infra/README.md).
   ```sh
   cd infra
   terraform init
   terraform plan -out tfplan
   terraform apply tfplan
   rm tfplan   # a saved plan holds a full copy of the state
   cd ..
   ```
   The remaining commands run from the repository root.

4. **Install ArgoCD using Ansible**
   ```sh
   ansible-playbook ansible/install-argocd.yaml
   ```

5. **Build and push Docker images (if not using CI/CD)**

   Tag images with the git commit, never `latest`, and point the Deployments
   at that tag. This is what CI does on every push to `main`.
   ```sh
   TAG=$(git rev-parse HEAD)
   docker build -t <ECR_BACKEND>:$TAG ./backend
   docker build -t <ECR_FRONTEND>:$TAG ./frontend
   aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <account>.dkr.ecr.<region>.amazonaws.com
   docker push <ECR_BACKEND>:$TAG
   docker push <ECR_FRONTEND>:$TAG
   # then set the image tag in k8s/backend-deployment.yaml and
   # k8s/frontend-deployment.yaml to $TAG and commit
   ```

6. **Create the Kubernetes secret for the database**

   `db-secret` is not stored in git and Argo CD does not manage it. Create it
   directly in the cluster. RDS generates the master password and keeps it
   in Secrets Manager, so copy it from there. `RDS_ENDPOINT` is the hostname
   without the `:5432` suffix (the `rds_address` output):
   ```sh
   aws secretsmanager get-secret-value \
       --secret-id "$(terraform -chdir=infra output -raw rds_master_user_secret_arn)" \
       --query SecretString --output text \
     | jq -j .password \
     | kubectl create secret generic db-secret \
         --from-literal=RDS_ENDPOINT="$(terraform -chdir=infra output -raw rds_address)" \
         --from-file=POSTGRES_PASSWORD=/dev/stdin
   ```
   The password goes straight from Secrets Manager into the Secret through
   stdin, so it never appears in shell history, a variable, a file or the
   kubectl command line. `jq -j` prints it without a trailing newline.

   Secrets Manager rotates this password every 7 days by default, and the
   copy in `db-secret` does not follow automatically. After a rotation,
   repeat the command above (after `kubectl delete secret db-secret`) and run
   `kubectl rollout restart deployment/backend`. See
   [docs/adr/0001-database-credentials.md](docs/adr/0001-database-credentials.md)
   for the planned automatic sync.

   For local `docker compose`, copy `.env.example` to `.env` and set
   `POSTGRES_PASSWORD` there. `.env` is gitignored.

7. **Apply/sync manifests with ArgoCD**
   - Port-forward ArgoCD server:
     ```sh
     kubectl port-forward svc/argocd-server -n argocd 8080:443
     ```
   - Login to ArgoCD CLI:
     ```sh
     argocd login localhost:8080 --username admin --insecure   # prompts for the password
     argocd app sync guestbook-app
     ```

8. **Verify deployment**
   ```sh
   kubectl get pods
   kubectl get svc
   ```

## Notes
- Do NOT commit `k8s/db-secret.yaml` or `.env` to git (both are in .gitignore).
- The CI/CD pipeline builds and pushes images when `backend/`, `frontend/` or
  the workflow change on `main`, once the AWS OIDC role and the `AWS_ROLE_ARN`
  repository variable exist (see [docs/ci-aws-oidc.md](docs/ci-aws-oidc.md)).
  It uses no stored AWS keys. Images are tagged with the commit SHA, and a
  second job commits that tag into the k8s Deployments so Argo CD rolls the
  pods. Roll back by reverting that commit.
- For ArgoCD API sync from CI/CD, expose ArgoCD server via LoadBalancer/Ingress and use an API token.
