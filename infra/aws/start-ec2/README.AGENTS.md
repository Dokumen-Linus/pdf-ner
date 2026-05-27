# start-ec2

- Purpose: start the EC2 app layer after bootstrap by checking the app checkout, Docker Compose/Buildx, Redis, and the Cloudflare Tunnel connector, then building and starting web, api, and worker.
- Executed by: `infra/aws/start-ec2/start-ec2.sh`
- Requires: `infra/aws/bootstrap-ec2/bootstrap-ec2.sh` already ran successfully, Redis is running, `cloudflared.service` is active, `infra/.env.prod` contains real public web build values, and AWS Secrets Manager app secrets exist.
- How to run: on the EC2 host, run `bash infra/aws/start-ec2/start-ec2.sh`. To use another bootstrap env file, pass it as the first argument or set `LOCAL_ENV_FILE`; the script reads `APP_DIR` and `ENV_FILE` from that file.
- Idempotent for normal reruns: rebuilds app images from the checked-out source, recreates app containers as needed, leaves the Redis volume in place, and leaves the Cloudflare Tunnel service unchanged.
