#!/usr/bin/env bash

setup_ec2_instance() {
  local monitoring_args termination_args key_args

  echo "Setting up EC2 instance"
  key_args=(--key-name "$KEY_NAME")
  monitoring_args=(--no-monitoring)
  if [ "$EC2_DETAILED_MONITORING" = "1" ]; then
    monitoring_args=(--monitoring Enabled=true)
  fi
  termination_args=(--disable-api-termination)
  if [ "$EC2_TERMINATION_PROTECTION" != "1" ]; then
    termination_args=(--no-disable-api-termination)
  fi

  INSTANCE_ID=$(aws_region ec2 run-instances \
    --image-id "$AMI_ID" \
    --instance-type "$INSTANCE_TYPE" \
    "${key_args[@]}" \
    --network-interfaces "DeviceIndex=0,SubnetId=${SUBNET_ID},Groups=${SG_ID},AssociatePublicIpAddress=false" \
    --iam-instance-profile "Name=${EC2_INSTANCE_PROFILE_NAME}" \
    --metadata-options "HttpTokens=required,HttpEndpoint=enabled,HttpPutResponseHopLimit=2" \
    --block-device-mappings "[{\"DeviceName\":\"/dev/xvda\",\"Ebs\":{\"VolumeSize\":${EC2_ROOT_VOLUME_SIZE},\"VolumeType\":\"gp3\",\"Encrypted\":true,\"DeleteOnTermination\":true}}]" \
    "${monitoring_args[@]}" \
    "${termination_args[@]}" \
    --tag-specifications "$(default_ec2_tag_spec instance "$INSTANCE_NAME")" \
    --query 'Instances[0].InstanceId' \
    --output text)

  tag_ec2_resource "$INSTANCE_ID" "$INSTANCE_NAME"
  aws_region ec2 wait instance-running --instance-ids "$INSTANCE_ID"
  aws_region ec2 modify-instance-metadata-options \
    --instance-id "$INSTANCE_ID" \
    --http-tokens required \
    --http-endpoint enabled \
    --http-put-response-hop-limit 2 >/dev/null
  ensure_instance_profile_attached "$INSTANCE_ID" "$EC2_INSTANCE_PROFILE_NAME"
  if [ "$EC2_TERMINATION_PROTECTION" = "1" ]; then
    aws_region ec2 modify-instance-attribute --instance-id "$INSTANCE_ID" --disable-api-termination '{"Value":true}'
  fi

  ALLOC_ID=$(aws_region ec2 allocate-address \
    --domain vpc \
    --tag-specifications "$(default_ec2_tag_spec elastic-ip "$EIP_NAME")" \
    --query 'AllocationId' \
    --output text)
  tag_ec2_resource "$ALLOC_ID" "$EIP_NAME"
  aws_region ec2 associate-address --instance-id "$INSTANCE_ID" --allocation-id "$ALLOC_ID" >/dev/null 2>&1 || true
  ELASTIC_IP="$(aws_region ec2 describe-addresses --allocation-ids "$ALLOC_ID" --query 'Addresses[0].PublicIp' --output text)"
}
