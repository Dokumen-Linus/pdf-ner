# push-secrets

- Purpose: put secrets in AWS Secrets Manager
- `create-secrets.sh` is create-only
- `update-secrets.sh` is update-only
- Set `STAGE=DEV` to read `dev-*.json` drafts and write `dev/*` secrets; omit it or set `STAGE=PROD` for the existing prod flow.
