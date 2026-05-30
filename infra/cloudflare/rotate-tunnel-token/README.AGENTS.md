# rotate-tunnel-token

- Purpose: rotate a remote-managed Cloudflare Tunnel connector token and print the new `TUNNEL_TOKEN` consumed by EC2 bootstrap.
- Executed by: `infra/cloudflare/rotate-tunnel-token/rotate-tunnel-token.sh`
- Read-only token fetch: `infra/cloudflare/rotate-tunnel-token/get-tunnel-token.sh`
- Requires: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and either `TUNNEL_ID` or a matching `TUNNEL_NAME`.
- How to run: copy `infra/cloudflare/rotate-tunnel-token/.env.example` to `infra/cloudflare/rotate-tunnel-token/.env.local`, fill in the Cloudflare values, then run the desired script with `bash`. To use another env file, pass it as the first argument or set `LOCAL_ENV_FILE`.
- Rotation replaces the token for new `cloudflared` connections; restart or reinstall connectors with the printed token.
