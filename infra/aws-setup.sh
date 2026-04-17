#!/usr/bin/env bash
# =============================================================================
# Dokumen AI — AWS Infrastructure Setup (from scratch)
# =============================================================================
#
# Creates: VPC, subnet, security group, EC2 (Amazon Linux 2023), Elastic IP,
#          S3 bucket (dokumen-web), IAM user with scoped S3 policy.
#
# Domain: dokumenai.dev (managed by Cloudflare)
# SSL:    Nginx Proxy Manager in Docker handles HTTP/HTTPS on EC2.
#         Cloudflare remains optional as DNS/CDN in front of the instance.
#
# Prerequisites:
#   - AWS CLI v2 installed and configured (aws configure)
#   - An SSH key pair file (~/.ssh/dokumen-ec2.pub) — generate with:
#       ssh-keygen -t ed25519 -f ~/.ssh/dokumen-ec2
#   - jq installed (for parsing AWS CLI JSON output)
#
# Usage:
#   chmod +x infra/aws-setup.sh
#   bash infra/aws-setup.sh 2>&1 | tee infra/aws-setup.log
#
# After running, save the output — it contains your Elastic IP, instance ID,
# IAM access keys, and Cloudflare DNS instructions.
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration — edit these before running
# ---------------------------------------------------------------------------
AWS_REGION="us-east-1"
INSTANCE_TYPE="t3.medium"
KEY_NAME="dokumen-ec2"
SSH_PUBKEY_PATH="$HOME/.ssh/dokumen-ec2.pub"
S3_BUCKET_NAME="dokumen-web"
IAM_USER_NAME="dokumen-s3-user"
DOMAIN="dokumenai.dev"

# Your current public IP — used to restrict SSH access
MY_IP=$(curl -s https://checkip.amazonaws.com)/32

echo "============================================="
echo "  Dokumen AI — AWS Infrastructure Setup"
echo "============================================="
echo "Region:        $AWS_REGION"
echo "Instance type: $INSTANCE_TYPE"
echo "SSH allowed:   $MY_IP"
echo "S3 bucket:     $S3_BUCKET_NAME"
echo "Domain:        $DOMAIN"
echo "============================================="
echo ""

# ---------------------------------------------------------------------------
# 1. VPC + Networking
# ---------------------------------------------------------------------------
echo ">>> 1. Creating VPC and networking..."

VPC_ID=$(aws ec2 create-vpc \
  --cidr-block 10.0.0.0/16 \
  --region "$AWS_REGION" \
  --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=dokumen-vpc}]' \
  --query 'Vpc.VpcId' --output text)
echo "    VPC: $VPC_ID"

# Enable DNS hostnames (required for public DNS names)
aws ec2 modify-vpc-attribute --vpc-id "$VPC_ID" --enable-dns-hostnames '{"Value":true}' --region "$AWS_REGION"

# Public subnet
SUBNET_ID=$(aws ec2 create-subnet \
  --vpc-id "$VPC_ID" \
  --cidr-block 10.0.1.0/24 \
  --availability-zone "${AWS_REGION}a" \
  --region "$AWS_REGION" \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=dokumen-public-subnet}]' \
  --query 'Subnet.SubnetId' --output text)
echo "    Subnet: $SUBNET_ID"

# Enable auto-assign public IP on launch
aws ec2 modify-subnet-attribute --subnet-id "$SUBNET_ID" --map-public-ip-on-launch --region "$AWS_REGION"

# Internet gateway
IGW_ID=$(aws ec2 create-internet-gateway \
  --region "$AWS_REGION" \
  --tag-specifications 'ResourceType=internet-gateway,Tags=[{Key=Name,Value=dokumen-igw}]' \
  --query 'InternetGateway.InternetGatewayId' --output text)
aws ec2 attach-internet-gateway --internet-gateway-id "$IGW_ID" --vpc-id "$VPC_ID" --region "$AWS_REGION"
echo "    Internet Gateway: $IGW_ID"

# Route table — default route to internet
RTB_ID=$(aws ec2 describe-route-tables \
  --filters "Name=vpc-id,Values=$VPC_ID" \
  --region "$AWS_REGION" \
  --query 'RouteTables[0].RouteTableId' --output text)
aws ec2 create-route --route-table-id "$RTB_ID" --destination-cidr-block 0.0.0.0/0 --gateway-id "$IGW_ID" --region "$AWS_REGION"
aws ec2 associate-route-table --route-table-id "$RTB_ID" --subnet-id "$SUBNET_ID" --region "$AWS_REGION" > /dev/null
echo "    Route table: $RTB_ID (0.0.0.0/0 → IGW)"

echo ""

# ---------------------------------------------------------------------------
# 2. Security Group
# ---------------------------------------------------------------------------
echo ">>> 2. Creating security group..."

SG_ID=$(aws ec2 create-security-group \
  --group-name dokumen-sg \
  --description "Dokumen AI - SSH, HTTP, HTTPS, NPM admin" \
  --vpc-id "$VPC_ID" \
  --region "$AWS_REGION" \
  --query 'GroupId' --output text)
echo "    Security group: $SG_ID"

# SSH — your IP only
aws ec2 authorize-security-group-ingress --group-id "$SG_ID" --protocol tcp --port 22 --cidr "$MY_IP" --region "$AWS_REGION" > /dev/null
echo "    Allowed SSH (22) from $MY_IP"

# HTTP + HTTPS — public
aws ec2 authorize-security-group-ingress --group-id "$SG_ID" --protocol tcp --port 80  --cidr 0.0.0.0/0 --region "$AWS_REGION" > /dev/null
aws ec2 authorize-security-group-ingress --group-id "$SG_ID" --protocol tcp --port 443 --cidr 0.0.0.0/0 --region "$AWS_REGION" > /dev/null
echo "    Allowed HTTP (80) and HTTPS (443) from 0.0.0.0/0"

# Nginx Proxy Manager admin UI — your IP only
aws ec2 authorize-security-group-ingress --group-id "$SG_ID" --protocol tcp --port 81 --cidr "$MY_IP" --region "$AWS_REGION" > /dev/null
echo "    Allowed NPM admin UI (81) from $MY_IP"

# NOTE: Ports 5432, 6379, 8000 are NOT exposed — Docker internal only.

echo ""

# ---------------------------------------------------------------------------
# 3. SSH Key Pair
# ---------------------------------------------------------------------------
echo ">>> 3. Importing SSH key pair..."

if [ ! -f "$SSH_PUBKEY_PATH" ]; then
  echo "    ERROR: $SSH_PUBKEY_PATH not found."
  echo "    Generate one: ssh-keygen -t ed25519 -f ~/.ssh/dokumen-ec2"
  exit 1
fi

aws ec2 import-key-pair \
  --key-name "$KEY_NAME" \
  --public-key-material "fileb://$SSH_PUBKEY_PATH" \
  --region "$AWS_REGION" > /dev/null 2>&1 || echo "    (key pair already exists, skipping)"
echo "    Key pair: $KEY_NAME"

echo ""

# ---------------------------------------------------------------------------
# 4. EC2 Instance (Amazon Linux 2023)
# ---------------------------------------------------------------------------
echo ">>> 4. Launching EC2 instance..."

# Get latest Amazon Linux 2023 AMI
AMI_ID=$(aws ec2 describe-images \
  --owners amazon \
  --filters \
    "Name=name,Values=al2023-ami-2023*-x86_64" \
    "Name=state,Values=available" \
  --region "$AWS_REGION" \
  --query 'Images | sort_by(@, &CreationDate) | [-1].ImageId' \
  --output text)
echo "    AMI: $AMI_ID (Amazon Linux 2023)"

INSTANCE_ID=$(aws ec2 run-instances \
  --image-id "$AMI_ID" \
  --instance-type "$INSTANCE_TYPE" \
  --key-name "$KEY_NAME" \
  --security-group-ids "$SG_ID" \
  --subnet-id "$SUBNET_ID" \
  --block-device-mappings '[{"DeviceName":"/dev/xvda","Ebs":{"VolumeSize":30,"VolumeType":"gp3"}}]' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=dokumen-ec2}]' \
  --region "$AWS_REGION" \
  --query 'Instances[0].InstanceId' --output text)
echo "    Instance: $INSTANCE_ID"

echo "    Waiting for instance to be running..."
aws ec2 wait instance-running --instance-ids "$INSTANCE_ID" --region "$AWS_REGION"
echo "    Instance is running."

echo ""

# ---------------------------------------------------------------------------
# 5. Elastic IP
# ---------------------------------------------------------------------------
echo ">>> 5. Allocating Elastic IP..."

ALLOC_ID=$(aws ec2 allocate-address \
  --domain vpc \
  --region "$AWS_REGION" \
  --tag-specifications 'ResourceType=elastic-ip,Tags=[{Key=Name,Value=dokumen-eip}]' \
  --query 'AllocationId' --output text)

ELASTIC_IP=$(aws ec2 describe-addresses \
  --allocation-ids "$ALLOC_ID" \
  --region "$AWS_REGION" \
  --query 'Addresses[0].PublicIp' --output text)

aws ec2 associate-address \
  --instance-id "$INSTANCE_ID" \
  --allocation-id "$ALLOC_ID" \
  --region "$AWS_REGION" > /dev/null
echo "    Elastic IP: $ELASTIC_IP → $INSTANCE_ID"

echo ""

# ---------------------------------------------------------------------------
# 6. S3 Bucket
# ---------------------------------------------------------------------------
echo ">>> 6. Creating S3 bucket: $S3_BUCKET_NAME..."

if [ "$AWS_REGION" = "us-east-1" ]; then
  aws s3api create-bucket \
    --bucket "$S3_BUCKET_NAME" \
    --region "$AWS_REGION" > /dev/null
else
  aws s3api create-bucket \
    --bucket "$S3_BUCKET_NAME" \
    --region "$AWS_REGION" \
    --create-bucket-configuration LocationConstraint="$AWS_REGION" > /dev/null
fi

# Block all public access (private bucket — accessed via IAM credentials only)
aws s3api put-public-access-block \
  --bucket "$S3_BUCKET_NAME" \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true" \
  --region "$AWS_REGION"

# Enable server-side encryption (AES-256)
aws s3api put-bucket-encryption \
  --bucket "$S3_BUCKET_NAME" \
  --server-side-encryption-configuration \
    '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}' \
  --region "$AWS_REGION"

# Enable versioning (protect against accidental deletes)
aws s3api put-bucket-versioning \
  --bucket "$S3_BUCKET_NAME" \
  --versioning-configuration Status=Enabled \
  --region "$AWS_REGION"

echo "    Bucket created: s3://$S3_BUCKET_NAME"
echo "    Public access: BLOCKED"
echo "    Encryption: AES-256"
echo "    Versioning: Enabled"

echo ""

# ---------------------------------------------------------------------------
# 7. IAM User + S3 Policy
# ---------------------------------------------------------------------------
echo ">>> 7. Creating IAM user for S3 access..."

aws iam create-user --user-name "$IAM_USER_NAME" > /dev/null 2>&1 || echo "    (user already exists)"

# Scoped policy — only this bucket
POLICY_ARN=$(aws iam create-policy \
  --policy-name dokumen-s3-policy \
  --policy-document "{
    \"Version\": \"2012-10-17\",
    \"Statement\": [
      {
        \"Effect\": \"Allow\",
        \"Action\": [
          \"s3:GetObject\",
          \"s3:PutObject\",
          \"s3:DeleteObject\",
          \"s3:ListBucket\",
          \"s3:GetBucketLocation\"
        ],
        \"Resource\": [
          \"arn:aws:s3:::$S3_BUCKET_NAME\",
          \"arn:aws:s3:::$S3_BUCKET_NAME/*\"
        ]
      }
    ]
  }" \
  --query 'Policy.Arn' --output text 2>/dev/null || \
  aws iam list-policies --scope Local --query "Policies[?PolicyName=='dokumen-s3-policy'].Arn" --output text)

aws iam attach-user-policy --user-name "$IAM_USER_NAME" --policy-arn "$POLICY_ARN"
echo "    IAM user: $IAM_USER_NAME"
echo "    Policy:   $POLICY_ARN"

# Create access keys
echo ""
echo "    Creating access keys..."
KEYS_JSON=$(aws iam create-access-key --user-name "$IAM_USER_NAME")
ACCESS_KEY_ID=$(echo "$KEYS_JSON" | jq -r '.AccessKey.AccessKeyId')
SECRET_ACCESS_KEY=$(echo "$KEYS_JSON" | jq -r '.AccessKey.SecretAccessKey')

echo ""
echo "    ┌──────────────────────────────────────────────────────────────────┐"
echo "    │  SAVE THESE NOW — the secret key is shown only once!            │"
echo "    ├──────────────────────────────────────────────────────────────────┤"
echo "    │  AWS_ACCESS_KEY_ID:     $ACCESS_KEY_ID"
echo "    │  AWS_SECRET_ACCESS_KEY: $SECRET_ACCESS_KEY"
echo "    └──────────────────────────────────────────────────────────────────┘"

echo ""

# ---------------------------------------------------------------------------
# 8. Summary + Cloudflare DNS Instructions
# ---------------------------------------------------------------------------
cat <<EOF

=============================================
  SETUP COMPLETE
=============================================

EC2 Instance:    $INSTANCE_ID
Instance Type:   $INSTANCE_TYPE
Elastic IP:      $ELASTIC_IP
VPC:             $VPC_ID
Security Group:  $SG_ID
S3 Bucket:       $S3_BUCKET_NAME
IAM User:        $IAM_USER_NAME

---------------------------------------------
SSH into your instance:

  ssh -i ~/.ssh/dokumen-ec2 ec2-user@$ELASTIC_IP

---------------------------------------------
CLOUDFLARE DNS SETUP (dokumenai.dev):

  Since your domain is on Cloudflare, you do NOT need CloudFront or ACM.
  Cloudflare can sit in front of Nginx Proxy Manager as your DNS/CDN layer.

  1. Go to Cloudflare Dashboard → dokumenai.dev → DNS

  2. Add these records:

     Type   Name   Content         Proxy   TTL
     ─────  ─────  ──────────────  ──────  ────
     A      @      $ELASTIC_IP     Proxied Auto
     A      www    $ELASTIC_IP     Proxied Auto

  3. Go to SSL/TLS → Overview → set mode to "Full" or "Full (Strict)"
     after you have issued certificates in Nginx Proxy Manager.

  4. In Nginx Proxy Manager:
     - Open http://$ELASTIC_IP:81 from your allowed IP
     - Log in to the admin UI
     - Create a Proxy Host for dokumenai.dev (and www if needed)
     - Forward to the Docker service name and port, e.g. `web:3000`
     - Request a Let's Encrypt certificate from within NPM

  5. If you keep Cloudflare proxied, leave ports 80/443 open to the public
     so HTTP validation and HTTPS traffic can reach Nginx Proxy Manager.

---------------------------------------------
ENVIRONMENT VARIABLES TO SET:

  Add to api/.env:
    AWS_ACCESS_KEY_ID=$ACCESS_KEY_ID
    AWS_SECRET_ACCESS_KEY=$SECRET_ACCESS_KEY

  Add to infra/.env:
    BETTER_AUTH_URL=https://dokumenai.dev

---------------------------------------------
NEXT STEPS:

  1. SSH into the instance
  2. Install Docker + Docker Compose (DEPLOY.md step 2)
  3. Clone the repo (DEPLOY.md step 3)
  4. Configure .env files (DEPLOY.md step 4)
  5. Build and start services (DEPLOY.md step 5)
  6. Open Nginx Proxy Manager at http://$ELASTIC_IP:81 from $MY_IP
  7. Set up Cloudflare DNS records (see above)
  8. Create proxy hosts and request certificates in NPM

=============================================
EOF
