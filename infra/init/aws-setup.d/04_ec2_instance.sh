#!/usr/bin/env bash

setup_ec2_instance() {
  echo ""
  echo ">>> EC2 instance"
  require_setup_values "EC2 instance" SG_ID SUBNET_ID
  ensure_ec2_bootstrap_instance_profile
  sleep 15

  AMI_ID=$(aws_region ec2 describe-images \
    --owners amazon \
    --filters "Name=name,Values=al2023-ami-2023*-x86_64" "Name=state,Values=available" \
    --query 'Images | sort_by(@, &CreationDate) | [-1].ImageId' \
    --output text)

  # shellcheck disable=SC2016
  INSTANCE_ID="$(get_single_id_by_name ec2 describe-instances "$INSTANCE_NAME" 'Reservations[].Instances[?State.Name!=`terminated`].InstanceId | [0]')"
  if [ -z "$INSTANCE_ID" ]; then
    local key_args monitoring_arg termination_arg
    key_args=()
    if [ "$EC2_SSH_ENABLED" = "1" ]; then
      key_args=(--key-name "$KEY_NAME")
    fi
    monitoring_arg="--no-monitoring"
    if [ "$EC2_DETAILED_MONITORING" = "1" ]; then
      monitoring_arg="--monitoring Enabled=true"
    fi
    termination_arg="--disable-api-termination"
    if [ "$EC2_TERMINATION_PROTECTION" != "1" ]; then
      termination_arg="--no-disable-api-termination"
    fi

    # shellcheck disable=SC2086
    INSTANCE_ID=$(aws_region ec2 run-instances \
      --image-id "$AMI_ID" \
      --instance-type "$INSTANCE_TYPE" \
      "${key_args[@]}" \
      --network-interfaces "DeviceIndex=0,SubnetId=${SUBNET_ID},Groups=${SG_ID},AssociatePublicIpAddress=false" \
      --iam-instance-profile "Name=${EC2_INSTANCE_PROFILE_NAME}" \
      --metadata-options "HttpTokens=required,HttpEndpoint=enabled" \
      --block-device-mappings "[{\"DeviceName\":\"/dev/xvda\",\"Ebs\":{\"VolumeSize\":${EC2_ROOT_VOLUME_SIZE},\"VolumeType\":\"gp3\",\"Encrypted\":true,\"DeleteOnTermination\":true}}]" \
      $monitoring_arg \
      "$termination_arg" \
      --tag-specifications "$(default_ec2_tag_spec instance "$INSTANCE_NAME")" \
      --query 'Instances[0].InstanceId' \
      --output text)
  fi
  tag_ec2_resource "$INSTANCE_ID" "$INSTANCE_NAME"
  aws_region ec2 wait instance-running --instance-ids "$INSTANCE_ID"
  ensure_instance_profile_attached "$INSTANCE_ID" "$EC2_INSTANCE_PROFILE_NAME"
  if [ "$EC2_TERMINATION_PROTECTION" = "1" ]; then
    aws_region ec2 modify-instance-attribute --instance-id "$INSTANCE_ID" --disable-api-termination '{"Value":true}'
  fi
  echo "    Instance: $INSTANCE_ID"

  ALLOC_ID="$(aws_region ec2 describe-addresses \
    --filters "$(tag_value_filter "$EIP_NAME")" \
    --query 'Addresses[0].AllocationId' \
    --output text 2>/dev/null | awk 'NF && $1 != "None" { print $1; exit }')"
  if [ -z "$ALLOC_ID" ]; then
    ALLOC_ID=$(aws_region ec2 allocate-address \
      --domain vpc \
      --tag-specifications "$(default_ec2_tag_spec elastic-ip "$EIP_NAME")" \
      --query 'AllocationId' \
      --output text)
  fi
  tag_ec2_resource "$ALLOC_ID" "$EIP_NAME"
  aws_region ec2 associate-address --instance-id "$INSTANCE_ID" --allocation-id "$ALLOC_ID" >/dev/null 2>&1 || true
  ELASTIC_IP="$(aws_region ec2 describe-addresses --allocation-ids "$ALLOC_ID" --query 'Addresses[0].PublicIp' --output text)"
  echo "    Elastic IP: $ELASTIC_IP"
}
