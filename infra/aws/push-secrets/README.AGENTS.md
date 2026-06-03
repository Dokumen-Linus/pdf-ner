# push-secrets

- Purpose: put secrets in AWS Secrets Manager
- `create-secrets.sh` is create-only
- `update-secrets.sh` is update-only
- Set `STAGE=DEV`, `SECRET_STAGE=DEV`, or `SECRETS_STAGE=dev` to read `dev-*.json` drafts and write `dev/*` secrets; omit them or set `STAGE=PROD` for prod
- Set `DRY_RUN=1` to validate secrets without pushing
