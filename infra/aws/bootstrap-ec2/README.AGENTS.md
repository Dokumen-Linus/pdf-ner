# bootstrap-ec2

- Purpose: bootstrap the EC2 runtime after the instance exists by installing host tools, syncing the app checkout, starting Redis once, and installing/enabling the Cloudflare Tunnel connector.
- Executed by: `infra/aws/bootstrap-ec2/bootstrap-ec2.sh`
- Requires: `TUNNEL_TOKEN` from `infra/cloudflare/setup-tunnel/setup-tunnel.sh` or the Cloudflare remote-managed Tunnel connector install flow.
- How to run: copy `infra/aws/bootstrap-ec2/.env.example` to `infra/aws/bootstrap-ec2/.env.local` on the EC2 host, fill in `TUNNEL_TOKEN`, then run `bash infra/aws/bootstrap-ec2/bootstrap-ec2.sh`. To use another env file, pass it as the first argument or set `LOCAL_ENV_FILE`.
- Idempotent for normal reruns: reuses an existing repo checkout, leaves existing `infra/.env.prod` in place, starts Redis without recreating its volume, and enables an existing `cloudflared.service` when present.
