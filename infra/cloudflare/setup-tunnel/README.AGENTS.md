# setup-tunnel

- Purpose: create or update the remote-managed Cloudflare Tunnel for production app traffic and print the connector `TUNNEL_TOKEN` consumed by EC2 bootstrap.
- Executed by: `infra/cloudflare/setup-tunnel/setup-tunnel.sh`
- Requires: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and `CLOUDFLARE_ZONE_ID`.
- How to run: copy `infra/cloudflare/setup-tunnel/.env.example` to `infra/cloudflare/setup-tunnel/.env.local`, fill in the Cloudflare values, then run `bash infra/cloudflare/setup-tunnel/setup-tunnel.sh`. To use another env file, pass it as the first argument or set `LOCAL_ENV_FILE`.
- Idempotent for normal reruns: reuses the named tunnel when it exists, rewrites the remote-managed ingress config, upserts proxied DNS CNAME records, and prints a fresh `TUNNEL_TOKEN`.
