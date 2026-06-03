# EC2 Management

This file explains setup-ec2, bootstrap-ec2, and modify-ec2 dirs *only*. For other infra/aws/ subdirs, refer to their README.AGENTS.md.

`setup-ec2/README.AGENTS.md`, `setup-ec2/README.AGENTS.md`, `setup-ec2/README.AGENTS.md` point to this file. If you read this, don't read them.

## Boundaries

setup-ec2: creation of the AWS resources for EC2 host and its dependencies
bootstrap-ec2: installation of host tools and starting of EC2-side services excluding Compose
modify-ec2: modification of EC2-side host tools, services, or the running Compose services

setup-ec2 and bootstrap-ec2 may not start Compose services. They must assume `.github/workflows/deploy-stack.yml` will start Compose after publishing the Docker images to repositories.

## Idempotency Requirements

Whether scripts must be able to be re-ran without error:

| Directory | Idempotent? |
| --- | --- |
| `setup-ec2/` | No |
| `bootstrap-ec2/` | Yes |
| `modify-ec2/` | No |

## setup-ec2

- Executed by `infra/aws/setup-ec2/setup-ec2.sh` which calls the other scripts to create the EC2 instance inside a VPC, create its instance profile, create ECR image registries, and setup for SSH from the admin IP

## bootstrap-ec2

- Scripts to be run in the EC2
- May not import any scripts or env files
- `bootstrap-ec2.sh`: install host tools
- `start-tunnel.sh`: starts system service for `cloudflared`
- `start-cloudwatch.sh`: adds CloudWatch logging

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

3. (steps 3- are orderless) Export the Tunnel token and run the tunnel service script:

```bash
cat << 'EOF' > start-tunnel.sh
# Paste content of infra/aws/bootstrap-ec2/start-tunnel.sh
EOF

export TUNNEL_TOKEN='TOKEN_FROM_infra/cloudflare/setup-tunnel/setup-tunnel.sh'

bash start-tunnel.sh
```

4. Run CloudWatch log shipping script:

```bash
cat << 'EOF' > start-cloudwatch.sh
# Paste content of infra/aws/bootstrap-ec2/start-cloudwatch.sh
EOF

bash start-cloudwatch.sh
```

## modify-ec2

- All modifications should also be added to the `bootstrap-ec2` or `setup-ec2` scripts.
- `add-cloudwatch.sh` adds CloudWatch service to an existing EC2 and updates its IAM role. `infra/aws/bootstrap-ec2/start-cloudwatch.sh` adds it to a new instance. `infra/aws/setup-ec2/setup-instance-profile.sh` was modified so new instances are created with the CloudWatch policy.
- `push-docker-compose.sh` replaces `$EC2_APP_DIR/infra/docker-compose.yml` with the local `infra/docker-compose.yml` through SSM by default with SSH as an explicit fallback. It must not run `docker compose`, start/restart app services, or update secrets.
- `migrate-redis-elasticache.sh` prepares an existing EC2 for ElastiCache after it is created by `infra/aws/setup-elasticache/setup-elasticache.sh`: it removes legacy Redis Docker containers/volumes/images and updates the existing EC2's IAM role with ElastiCache describe permission. It assumes `infra/aws/modify-ec2/push-docker-compose.sh` already replaced the EC2 Compose file. It must not run `docker compose`, start/restart app services, or update secrets. Use `infra/aws/push-secrets/update-secrets.sh` for Redis URL secrets, then `.github/workflows/deploy-stack.yml` to deploy app containers.
