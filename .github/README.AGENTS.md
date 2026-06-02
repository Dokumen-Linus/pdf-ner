# Workflows

- auto-docs: generate CHANGELOG.md and .codesight/wiki
- auto-format: format code (Python with ruff, TypeScript with prettier and eslint)
- commitlint: enforces commit pattern
- deploy-api: deploy API to AWS
- deploy-web: deploy web to AWS
- deploy-workers: deploy workers to AWS
- deploy-stack: build and deploy all three services (web + api + workers) at once; manual-only, intended for initial EC2 bootstrap
- ec2-healthcheck: manual-only wait-then-run EC2 health check; deploy workflows must not call it automatically
