# setup-waf

- Purpose: create or update zone-level Cloudflare WAF rules before Tunnel and EC2 bootstrap are run.
- Executed by:
  - `infra/cloudflare/setup-waf/setup-waf-free.sh` — for Free plan zones (uses Cloudflare Free Managed Ruleset)
  - `infra/cloudflare/setup-waf/setup-waf-pro.sh` — for Pro+ plan zones (Cloudflare Managed + OWASP Core PL2 + Exposed Credentials Check + Leaked Credentials Detection)
- Requires: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and `CLOUDFLARE_ZONE_ID`.
- How to run: copy `infra/cloudflare/setup-waf/.env.example` to `infra/cloudflare/setup-waf/.env.local`, fill in the Cloudflare values, then run e.g. `bash infra/cloudflare/setup-waf/setup-waf-free.sh`. To use another env file, pass it as the first argument or set `LOCAL_ENV_FILE`.
- Idempotent for normal reruns: updates only rules with Dokumen-owned `ref` values and preserves unrelated rules in the same Cloudflare phase entry point rulesets.
- Run order: run this first, then `infra/cloudflare/setup-tunnel/setup-tunnel.sh`, then `infra/aws/bootstrap-ec2/bootstrap-ec2.sh` with the Tunnel token.
