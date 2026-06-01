# bootstrap-ec2

- Purpose: bootstrap the EC2 host after the instance exists by installing host tools and starting `cloudflared` service
- Idempotent
- Must run in AWS EC2 so may not import any scripts or env files
- `setup-cloudwatch-logs.sh` is the separate EC2-side CloudWatch Logs bootstrap. It installs and configures the Amazon CloudWatch agent for Docker container logs and host/service logs.

## How to Run

1. Connect to EC2

Either (a) Connect using SSM on AWS Console or (b) SSH into the EC2 host

```bash
ssh -i "$HOME/.ssh/dokumen-ec2" ec2-user@<ELASTIC_IP>
```

2. Run bootstrap script

```bash
cat << 'EOF' > bootstrap-ec2.sh
# Paste content of infra/aws/bootstrap-ec2/bootstrap-ec2.sh
EOF

bash bootstrap-ec2.sh
```

3. Export the Tunnel token and run the tunnel service script:

```bash
cat << 'EOF' > start-tunnel.sh
# Paste content of infra/aws/bootstrap-ec2/start-tunnel.sh
EOF

export TUNNEL_TOKEN='<token-from-infra/cloudflare/setup-tunnel/setup-tunnel.sh>'

bash start-tunnel.sh
```

4. Run CloudWatch log shipping setup:

```bash
cat << 'EOF' > setup-cloudwatch-logs.sh
# Paste content of infra/aws/bootstrap-ec2/setup-cloudwatch-logs.sh
EOF

bash setup-cloudwatch-logs.sh
```

Optional defaults:

- `AWS_REGION=us-east-1`
- `CLOUDWATCH_LOG_GROUP_PREFIX=/dokumen/production/ec2`
- `CLOUDWATCH_LOG_RETENTION_DAYS=14`
- `CLOUDWATCH_AGENT_CONFIG_PATH=/opt/aws/amazon-cloudwatch-agent/etc/cloudwatch-agent.json`
