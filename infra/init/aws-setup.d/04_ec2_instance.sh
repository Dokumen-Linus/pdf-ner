#!/usr/bin/env bash

setup_ec2_instance() {
  echo ""
  echo ">>> 4. EC2 instance"

  AMI_ID=$(aws_region ec2 describe-images \
    --owners amazon \
    --filters "Name=name,Values=al2023-ami-2023*-x86_64" "Name=state,Values=available" \
    --query 'Images | sort_by(@, &CreationDate) | [-1].ImageId' \
    --output text)

  INSTANCE_ID="$(get_single_id_by_name ec2 describe-instances "$INSTANCE_NAME" 'Reservations[].Instances[?State.Name!=`terminated`].InstanceId | [0]')"
  if [ -z "$INSTANCE_ID" ]; then
    INSTANCE_ID=$(aws_region ec2 run-instances \
      --image-id "$AMI_ID" \
      --instance-type "$INSTANCE_TYPE" \
      --key-name "$KEY_NAME" \
      --security-group-ids "$SG_ID" \
      --subnet-id "$SUBNET_ID" \
      --metadata-options "HttpTokens=required,HttpEndpoint=enabled" \
      --block-device-mappings '[{"DeviceName":"/dev/xvda","Ebs":{"VolumeSize":40,"VolumeType":"gp3","DeleteOnTermination":true}}]' \
      --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=${INSTANCE_NAME}}]" \
      --query 'Instances[0].InstanceId' \
      --output text)
  fi
  aws_region ec2 wait instance-running --instance-ids "$INSTANCE_ID"
  echo "    Instance: $INSTANCE_ID"

  ALLOC_ID="$(aws_region ec2 describe-addresses \
    --filters "$(tag_value_filter "$EIP_NAME")" \
    --query 'Addresses[0].AllocationId' \
    --output text 2>/dev/null | awk 'NF && $1 != "None" { print $1; exit }')"
  if [ -z "$ALLOC_ID" ]; then
    ALLOC_ID=$(aws_region ec2 allocate-address \
      --domain vpc \
      --tag-specifications "ResourceType=elastic-ip,Tags=[{Key=Name,Value=${EIP_NAME}}]" \
      --query 'AllocationId' \
      --output text)
  fi
  aws_region ec2 associate-address --instance-id "$INSTANCE_ID" --allocation-id "$ALLOC_ID" >/dev/null 2>&1 || true
  ELASTIC_IP="$(aws_region ec2 describe-addresses --allocation-ids "$ALLOC_ID" --query 'Addresses[0].PublicIp' --output text)"
  echo "    Elastic IP: $ELASTIC_IP"
}
