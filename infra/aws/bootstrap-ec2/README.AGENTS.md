# bootstrap-ec2

- Purpose: bootstrap the EC2 runtime after the instance exists by installing host tools, syncing the app checkout, starting Redis once, installing/enabling `cloudflared.service`, and verifying the Cloudflare Tunnel origin posture.
- Executed by: `infra/aws/bootstrap-ec2/bootstrap-ec2.sh`
- Requires: `TUNNEL_TOKEN` from `infra/cloudflare/setup-tunnel/setup-tunnel.sh` or the Cloudflare remote-managed Tunnel connector install flow.
- How to run: copy `infra/aws/bootstrap-ec2/.env.example` to `infra/aws/bootstrap-ec2/.env.local` on the EC2 host, fill in `TUNNEL_TOKEN`, then run `bash infra/aws/bootstrap-ec2/bootstrap-ec2.sh`. To use another env file, pass it as the first argument or set `LOCAL_ENV_FILE`.
- SSH bootstrap path: `infra/aws/setup-ec2/setup-key-pair.sh` imports the public key at `SSH_PUBKEY_PATH` into EC2 as `KEY_NAME`; SSH with the matching private key, usually the same path without `.pub`. Use the EC2 Elastic IP printed by `infra/aws/setup-ec2/setup-ec2.sh` in `infra/aws/outputs/ec2-resources.env`, connect as `ec2-user`, clone or refresh this repo on the host, and run the bootstrap script with the Cloudflare Tunnel token:

```bash
SSH_PUBKEY_PATH="${SSH_PUBKEY_PATH:-$HOME/.ssh/dokumen-ec2.pub}"
SSH_PRIVATE_KEY_PATH="${SSH_PRIVATE_KEY_PATH:-${SSH_PUBKEY_PATH%.pub}}"
EC2_PUBLIC_IP="${EC2_PUBLIC_IP:-REPLACE_WITH_ELASTIC_IP_FROM_SETUP_EC2_OUTPUT}"
TUNNEL_TOKEN="${TUNNEL_TOKEN:-REPLACE_WITH_CLOUDFLARE_TUNNEL_TOKEN}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-master}"
REPO_URL="${REPO_URL:-https://github.com/dokumenai/pdf-ner.git}"
REMOTE_BOOTSTRAP_DIR="${REMOTE_BOOTSTRAP_DIR:-$HOME/pdf-ner-bootstrap}"

chmod 600 "$SSH_PRIVATE_KEY_PATH"
printf -v REMOTE_ENV 'TUNNEL_TOKEN=%q DEPLOY_BRANCH=%q REPO_URL=%q REMOTE_BOOTSTRAP_DIR=%q' \
  "$TUNNEL_TOKEN" "$DEPLOY_BRANCH" "$REPO_URL" "$REMOTE_BOOTSTRAP_DIR"

ssh -i "$SSH_PRIVATE_KEY_PATH" "ec2-user@${EC2_PUBLIC_IP}" "${REMOTE_ENV} bash -s" <<'REMOTE_BOOTSTRAP'
set -euo pipefail

if ! command -v git >/dev/null 2>&1; then
  sudo dnf install -y git
fi

if [ -d "${REMOTE_BOOTSTRAP_DIR}/.git" ]; then
  git -C "$REMOTE_BOOTSTRAP_DIR" fetch origin "$DEPLOY_BRANCH"
  git -C "$REMOTE_BOOTSTRAP_DIR" checkout "$DEPLOY_BRANCH"
  git -C "$REMOTE_BOOTSTRAP_DIR" pull --ff-only origin "$DEPLOY_BRANCH"
else
  git clone --branch "$DEPLOY_BRANCH" "$REPO_URL" "$REMOTE_BOOTSTRAP_DIR"
fi

cd "$REMOTE_BOOTSTRAP_DIR"
LOCAL_ENV_FILE=/dev/null TUNNEL_TOKEN="$TUNNEL_TOKEN" bash infra/aws/bootstrap-ec2/bootstrap-ec2.sh
REMOTE_BOOTSTRAP
```

- Idempotent for normal reruns: reuses an existing repo checkout, leaves existing `infra/.env.prod` in place, starts Redis without recreating its volume, and enables an existing `cloudflared.service` when present.
- App start path: this script does not build or start the app images. After bootstrap succeeds, trigger GitHub Actions `Deploy Stack` to build `web`, `api`, and `workers`, push the images to ECR, start `redis api worker web` on EC2 through SSM, and run the EC2 health check.
