# Runpod Pod Deployment

The authoritative GPU deployment explanation lives in `gpu/README.md`.

This directory contains the operator scripts used by that workflow:

- `ecr-login.sh` - ensure the GPU ECR repositories exist and log Docker in.
- `sync-ecr-runpod-registry-auth.sh` - create a fresh Runpod registry auth from
  the current AWS ECR token.
- `runpod-deploy-pods.sh` - build, push, refresh auth, and update the two fixed
  Runpod Pods.
- `runpod-pod-action.sh` - refresh ECR auth before Pod lifecycle actions.
- `test-pods.sh` - smoke test the deployed Pod proxy URLs.
- `runpod-setup.sh` and `test-endpoints.sh` - compatibility wrappers for the
  new Pod flow.

The deployment no longer creates Runpod Serverless templates or endpoints.
