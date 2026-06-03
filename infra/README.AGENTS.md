# Dokumen Infrastructure

- `aws\`: scripts for initial AWS resource setup, pushing secrets, and other AWS interaction
- `cloudflare\`: scripts for Cloudflare WAF and Tunnel setup
- `github\`: scripts for GitHub setup
- `runpod\`: scripts for creating and managing runpod instances as well as their AWS ECR images and granting the EC2 access
- `docker-compose.yml`: production Compose file for EC2; Redis is externalized to ElastiCache
- `local/docker-compose.yml`: local dev Compose file that still includes local Redis
- `.env.prod.example`: example of `.env.prod` to define the public web client-side environment variables and environment variables for the CI flow

`.env.prod` is reserved for this file. All other files in this repo should be `.env.production`, `.env.development` or `.env.local`.

## RDS Databases

1. Resources created in `infra/aws/setup-database`
2. Database initialization in `db/deploy-rds`

Dev database instance: `dokudev`
Prod database instance: `dokuprod`

## GitHub Actions CI

- Docker images may only be built by workflows, not bash scripts
- The `deploy-*.yml` Actions build Docker images, push them to ECR, and use AWS Systems Manager Run Command to tell the EC2 instance to pull and start/restart Compose services
- Refer to `.github/README.AGENTS.md` for workflow-specific details
