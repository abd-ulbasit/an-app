# AWS Load Balancer Controller Helm Install

Install the AWS Load Balancer Controller using Helm CLI after EKS and IAM setup:

```sh
helm repo add eks https://aws.github.io/eks-charts
helm repo update
helm upgrade --install aws-load-balancer-controller eks/aws-load-balancer-controller \
  --namespace kube-system \
  --set clusterName=guestbook-eks \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller \
  --set region=ap-south-1 \
  --set vpcId=vpc-097ab8f9d8835d12c
```

- Ensure your kubeconfig context is set to your EKS cluster.
- IAM role and service account must be created by Terraform before running this command.
