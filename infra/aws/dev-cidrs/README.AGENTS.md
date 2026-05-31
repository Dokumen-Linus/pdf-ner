# dev-cidrs

- Purpose: manage local development CIDR access for the development RDS security group and DEV Secrets Manager read policy
- `add-dev-cidr.sh` adds `DEV_CIDR` to both the dev RDS security group and the dev secrets IAM policy
- `rotate-dev-cidr.sh` removes `PREVIOUS_DEV_CIDR` and adds `DEV_CIDR` in both places
- `clear-dev-cidrs.sh` clears extra CIDRs from the dev RDS security group and dev secrets IAM policy, leaving only `DEV_CIDR` in both places
- `DEV_IPV6_CIDR` and `PREVIOUS_DEV_IPV6_CIDR` apply to both the dev RDS security group and the dev secrets IAM policy
- `base-policy.json` is the static starting policy document; scripts import it through `lib.sh`
- Keep shared shell helpers in `lib.sh`; the three entry scripts should stay thin
- Idempotent, including for adding CIDRs and attaching policy to optional `DEV_SECRETS_IAM_USER_NAME` or `DEV_SECRETS_IAM_ROLE_NAME`
