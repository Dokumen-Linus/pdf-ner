#!/usr/bin/env bash

print_summary() {
  cat <<EOF

=============================================
  SETUP COMPLETE
=============================================

EC2 instance:       $INSTANCE_ID
Elastic IP:         $ELASTIC_IP
VPC:                $VPC_ID
Public subnet:      $SUBNET_ID
Security group:     $SG_ID
EC2 runtime role:   $EC2_ROLE_ARN
GitHub deploy role: $GITHUB_DEPLOY_ROLE_ARN
ECR web repo:       ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${WEB_ECR_REPOSITORY}
ECR API repo:       ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${API_ECR_REPOSITORY}
ECR workers repo:   ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${WORKERS_ECR_REPOSITORY}
ECR DeepSeek repo:  ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${GPU_DEEPSEEK_ECR_REPOSITORY}
ECR olmOCR2 repo:   ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${GPU_OLM_OCR2_ECR_REPOSITORY}
Avatar S3 bucket:   $AVATARS_S3_BUCKET_NAME
SES identity email: $SES_IDENTITY_EMAIL

DNS records to create in Cloudflare:
  A    @      $ELASTIC_IP
  A    www    $ELASTIC_IP

SSH:
  ssh -i "$SSH_PRIVATE_KEY_PATH" ec2-user@$ELASTIC_IP

Local AWS Secrets Manager draft JSON files:
  $SECRET_DRAFT_DIR

Review and complete all placeholder fields, then create Secrets Manager secrets:
  bash infra/init/create-secrets.sh

Nginx Proxy Manager:
  http://$ELASTIC_IP:81

GitHub Actions secrets:
  AWS_GITHUB_DEPLOY_ROLE_ARN=$GITHUB_DEPLOY_ROLE_ARN
  EC2_INSTANCE_ID=$INSTANCE_ID

GitHub Actions variables:
  AWS_REGION=$AWS_REGION
  API_ECR_REPOSITORY=$API_ECR_REPOSITORY
  WEB_ECR_REPOSITORY=$WEB_ECR_REPOSITORY
  WORKERS_ECR_REPOSITORY=$WORKERS_ECR_REPOSITORY
  GPU_DEEPSEEK_ECR_REPOSITORY=$GPU_DEEPSEEK_ECR_REPOSITORY
  GPU_OLM_OCR2_ECR_REPOSITORY=$GPU_OLM_OCR2_ECR_REPOSITORY
  DEEPSEEK_RUNPOD_POD_ID=<fixed-deepseek-pod-id>
  OLM_OCR2_RUNPOD_POD_ID=<fixed-olm-pod-id>
  EC2_APP_DIR=$REMOTE_APP_DIR
  VITE_BASE_URL=https://$DOMAIN
  VITE_STRIPE_PUBLISHABLE_KEY=<your-stripe-publishable-key>

EOF
}
