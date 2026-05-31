# rotate-admin-cidr

- Purpose: reset existing admin-only security group ingress rules to the current `ADMIN_CIDR`
- Executed by: `infra/aws/rotate-admin-cidr/rotate-admin-cidr.sh`
- Idempotent for the managed rules
- Scope: EC2 tcp/22, production RDS tcp/${RDS_PORT}, development RDS tcp/${RDS_PORT}
- Do not add database, EC2, or VPC creation behavior here; this folder only updates existing security group ingress
- Localhost development CIDR access for dev RDS and DEV Secrets Manager belongs in `infra/aws/dev-cidrs`
