# dev-cidrs

- Purpose: manage local development CIDR access for the development RDS security group and the DEV Secrets Manager read policy
- `add-dev-cidr.sh` adds `DEV_CIDR` and optional `DEV_IPV6_CIDR` to the dev RDS security group, then ensures the dev secrets IAM policy
- `rotate-dev-cidr.sh` removes previous CIDRs and adds current CIDRs for the dev RDS security group, then ensures the dev secrets IAM policy
- `clear-dev-cidrs.sh` clears extra CIDRs from the dev RDS security group, leaving only current CIDRs, then ensures the dev secrets IAM policy
- The dev secrets IAM policy intentionally has no CIDR condition; access is scoped by IAM identity and dev secret resource ARNs
- `DEV_IPV6_CIDR` and `PREVIOUS_DEV_IPV6_CIDR` apply to the dev RDS security group only
- `base-policy.json` is the static starting policy document; scripts import it through `lib.sh`
- Keep shared shell helpers in `lib.sh`; the three entry scripts should stay thin
- Idempotent, including for adding CIDRs and attaching policy to optional `DEV_SECRETS_IAM_USER_NAME` or `DEV_SECRETS_IAM_ROLE_NAME`
