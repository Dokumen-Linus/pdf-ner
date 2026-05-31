# dev-cidrs

- Purpose: manage local development CIDR access for the development RDS security group and DEV Secrets Manager read policy
- `add-dev-cidr.sh` adds `DEV_CIDR` to both the dev RDS security group and the dev secrets IAM policy
- `rotate-dev-cidr.sh` removes `PREVIOUS_DEV_CIDR` and adds `DEV_CIDR` in both places
- `clear-dev-cidrs.sh` clears extra CIDRs from the dev RDS security group and dev secrets IAM policy, leaving only `DEV_CIDR` in both places
- Idempotent, including for adding CIDRs and attaching policy to optional `DEV_SECRETS_IAM_USER_NAME` or `DEV_SECRETS_IAM_ROLE_NAME`
