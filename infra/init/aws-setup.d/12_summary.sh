#!/usr/bin/env bash

print_summary() {
  cat <<EOF

=============================================
  SETUP COMPLETE
=============================================

EC2 instance:       ${INSTANCE_ID:-unknown}
Elastic IP:         ${ELASTIC_IP:-unknown}
VPC:                ${VPC_ID:-unknown}
Public subnet:      ${SUBNET_ID:-unknown}
Public subnet 2:    ${SUBNET_2_ID:-unknown}
Private subnet:     ${PRIVATE_SUBNET_ID:-unknown}
Private subnet 2:   ${PRIVATE_SUBNET_2_ID:-unknown}
NAT gateway:        ${NAT_GATEWAY_ID:-unknown}
NAT gateway 2:      ${NAT_GATEWAY_2_ID:-unknown}
VPC flow log:       ${VPC_FLOW_LOG_ID:-unknown}
Security group:     ${SG_ID:-unknown}
EC2 runtime role:   ${EC2_ROLE_ARN:-unknown}
GitHub deploy role: ${GITHUB_DEPLOY_ROLE_ARN:-unknown}
ECR web repo:       ${ACCOUNT_ID:-unknown}.dkr.ecr.${AWS_REGION}.amazonaws.com/${WEB_ECR_REPOSITORY}
ECR API repo:       ${ACCOUNT_ID:-unknown}.dkr.ecr.${AWS_REGION}.amazonaws.com/${API_ECR_REPOSITORY}
ECR workers repo:   ${ACCOUNT_ID:-unknown}.dkr.ecr.${AWS_REGION}.amazonaws.com/${WORKERS_ECR_REPOSITORY}
ECR DeepSeek repo:  ${ACCOUNT_ID:-unknown}.dkr.ecr.${AWS_REGION}.amazonaws.com/${GPU_DEEPSEEK_ECR_REPOSITORY}
ECR olmOCR2 repo:   ${ACCOUNT_ID:-unknown}.dkr.ecr.${AWS_REGION}.amazonaws.com/${GPU_OLM_OCR2_ECR_REPOSITORY}
Avatar S3 bucket:   ${AVATARS_S3_BUCKET_NAME:-unknown}
SES identity email: $SES_IDENTITY_EMAIL
Production RDS:     ${PROD_RDS_HOST:-skipped}
Development RDS:    ${DEV_RDS_HOST:-skipped}
RDS admin CIDR:     ${MY_IP:-unknown}
State file:         $SETUP_STATE_FILE
State report:       $SETUP_REPORT_FILE

DNS records to create in Cloudflare:
  A    @      ${ELASTIC_IP:-unknown}
  A    www    ${ELASTIC_IP:-unknown}

SSH:
  ssh -i "$SSH_PRIVATE_KEY_PATH" ec2-user@${ELASTIC_IP:-unknown}

Local AWS Secrets Manager draft JSON files:
  $SECRET_DRAFT_DIR

Review and complete all placeholder fields, then create Secrets Manager secrets:
  bash infra/init/create-secrets.sh

RDS admin ingress refresh:
  REFRESH_RDS_ADMIN_IP=$REFRESH_RDS_ADMIN_IP
  bash infra/init/authorize-rds-admin-ip.sh

Nginx Proxy Manager:
  http://${ELASTIC_IP:-unknown}:81

GitHub Actions secrets:
  AWS_GITHUB_DEPLOY_ROLE_ARN=${GITHUB_DEPLOY_ROLE_ARN:-unknown}
  EC2_INSTANCE_ID=${INSTANCE_ID:-unknown}

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
