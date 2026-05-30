# bootstrap-ec2

- Purpose: bootstrap the EC2 host after the instance exists by installing host tools and starting `cloudflared` service
- Idempotent
- Must run in AWS EC2 so may not import any scripts or env files

## How to Run

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

3. Export the Tunnel token and run the tunnel service script:

```bash
cat << 'EOF' > start-tunnel.sh
# Paste content of infra/aws/bootstrap-ec2/start-tunnel.sh
EOF

export TUNNEL_TOKEN='<token-from-infra/cloudflare/setup-tunnel/setup-tunnel.sh>'

bash start-tunnel.sh
```
