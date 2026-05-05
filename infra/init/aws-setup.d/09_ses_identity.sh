#!/usr/bin/env bash

setup_ses_identity() {
  echo ""
  echo ">>> 9. SES identity"
  aws_region ses verify-email-identity --email-address "$SES_IDENTITY_EMAIL" >/dev/null 2>&1 || true
  echo "    Verification email requested for: $SES_IDENTITY_EMAIL"
  echo "    SES can send production email only after identity verification and sandbox exit."
}
