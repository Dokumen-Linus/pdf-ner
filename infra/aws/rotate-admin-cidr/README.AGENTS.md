# rotate-admin-cidr

- Purpose: reset existing admin-only security group ingress rules to the current `ADMIN_CIDR`
- Executed by: `infra/aws/rotate-admin-cidr/rotate-admin-cidr.sh`
- Idempotent for the managed rules
- Scope: EC2 tcp/22 and development RDS tcp/${RDS_PORT}
- Production RDS is private and must not be managed by admin CIDR rotation; connect through SSM or SSH port forwarding instead
- Do not add database, EC2, or VPC creation behavior here; this folder only updates existing security group ingress
- Localhost development CIDR access for dev RDS and DEV Secrets Manager belongs in `infra/aws/dev-cidrs`
