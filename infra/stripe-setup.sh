#!/usr/bin/env bash
# =============================================================================
# Dokumen AI - Stripe Billing Setup
# =============================================================================
#
# Creates the Stripe Meter and Prices expected by BILLING.md and the web billing flow:
#   - Developer subscription seat: $10/month
#   - Analyst subscription seat:   $5/month
#   - LLM usage metered price:      $0.000001 per reported unit
#
# The worker reports usage in integer microdollar units:
#   workers/app/domains/billing/domain/services.py
#
# Therefore the usage price is 0.0001 cents per unit, which equals $0.000001.
# Do not lower USAGE_UNIT_AMOUNT_DECIMAL_CENTS unless the worker conversion is
# changed at the same time, otherwise Stripe invoices will under-bill usage.
#
# Prerequisites:
#   - Stripe CLI installed and logged in, or STRIPE_SECRET_KEY exported
#   - jq installed
#
# Usage:
#   bash infra/stripe-setup.sh
#   STRIPE_SECRET_KEY=sk_test_... bash infra/stripe-setup.sh
#
# Notes:
#   - Uses Stripe API version 2025-02-24.acacia or later to support Billing Meters.
#   - Prices are immutable in Stripe. To change amounts, create new lookup keys
#     below and update web/.env.local with the new Price IDs.
# =============================================================================

set -euo pipefail

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
CURRENCY="${CURRENCY:-usd}"
STRIPE_API_VERSION="${STRIPE_API_VERSION:-2025-02-24.acacia}"

DEVELOPER_LOOKUP_KEY="${DEVELOPER_LOOKUP_KEY:-dokumen_developer_monthly_v1}"
ANALYST_LOOKUP_KEY="${ANALYST_LOOKUP_KEY:-dokumen_analyst_monthly_v1}"
USAGE_LOOKUP_KEY="${USAGE_LOOKUP_KEY:-dokumen_llm_usage_microdollar_v1}"
USAGE_METER_EVENT_NAME="${USAGE_METER_EVENT_NAME:-dokumen_llm_usage}"

DEVELOPER_PRODUCT_NAME="${DEVELOPER_PRODUCT_NAME:-Dokumen AI Developer Subscription}"
ANALYST_PRODUCT_NAME="${ANALYST_PRODUCT_NAME:-Dokumen AI Analyst Subscription}"
USAGE_PRODUCT_NAME="${USAGE_PRODUCT_NAME:-Dokumen AI LLM Usage}"

DEVELOPER_UNIT_AMOUNT_CENTS="${DEVELOPER_UNIT_AMOUNT_CENTS:-1000}"
ANALYST_UNIT_AMOUNT_CENTS="${ANALYST_UNIT_AMOUNT_CENTS:-500}"
USAGE_UNIT_AMOUNT_DECIMAL_CENTS="${USAGE_UNIT_AMOUNT_DECIMAL_CENTS:-0.0001}"

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "ERROR: '$command_name' is required but was not found in PATH." >&2
    exit 1
  fi
}

format_cents() {
  local cents="$1"
  printf '%d.%02d' "$((cents / 100))" "$((cents % 100))"
}

stripe_call() {
  if [ -n "${STRIPE_SECRET_KEY:-}" ]; then
    stripe "$@" --api-key "$STRIPE_SECRET_KEY" --stripe-version "$STRIPE_API_VERSION"
  else
    stripe "$@" --stripe-version "$STRIPE_API_VERSION"
  fi
}

verify_stripe_access() {
  echo "Checking Stripe API access..." >&2
  if ! stripe_call account retrieve >/dev/null; then
    echo "ERROR: Stripe API access failed. Run 'stripe login' or export a valid STRIPE_SECRET_KEY." >&2
    exit 1
  fi
}

find_price_by_lookup_key() {
  local lookup_key="$1"

  stripe_call prices list \
    --active=true \
    --limit=1 \
    -d "lookup_keys[]=$lookup_key" | jq -r '.data[0].id // empty'
}

create_or_get_fixed_price() {
  local lookup_key="$1"
  local product_name="$2"
  local unit_amount_cents="$3"
  local role="$4"

  local existing_price_id
  existing_price_id="$(find_price_by_lookup_key "$lookup_key")"
  if [ -n "$existing_price_id" ]; then
    echo "Reusing $role price: $existing_price_id" >&2
    printf '%s\n' "$existing_price_id"
    return
  fi

  echo "Creating $role price..." >&2
  stripe_call prices create \
    -d "currency=$CURRENCY" \
    -d "unit_amount=$unit_amount_cents" \
    -d "recurring[interval]=month" \
    -d "recurring[usage_type]=licensed" \
    -d "product_data[name]=$product_name" \
    -d "product_data[unit_label]=seat" \
    -d "lookup_key=$lookup_key" \
    -d "nickname=$role monthly seat" \
    -d "metadata[dokumen_resource]=$role" \
    -d "metadata[billing_contract]=BILLING.md" | jq -r '.id'
}

find_meter_by_event_name() {
  local event_name="$1"

  stripe_call billing meters list \
    --status=active \
    --limit=1 | jq -r --arg name "$event_name" '.data[] | select(.event_name == $name) | .id // empty'
}

create_or_get_meter() {
  local existing_meter_id
  existing_meter_id="$(find_meter_by_event_name "$USAGE_METER_EVENT_NAME")"
  if [ -n "$existing_meter_id" ]; then
    echo "Reusing meter: $existing_meter_id" >&2
    printf '%s\n' "$existing_meter_id"
    return
  fi

  echo "Creating billing meter..." >&2
  stripe_call billing meters create \
    -d "display_name=$USAGE_PRODUCT_NAME" \
    -d "event_name=$USAGE_METER_EVENT_NAME" \
    -d "default_aggregation[formula]=sum" \
    -d "customer_mapping[event_payload_key]=stripe_customer_id" \
    -d "customer_mapping[type]=by_id" \
    -d "value_settings[event_payload_key]=value" | jq -r '.id'
}

create_or_get_usage_price() {
  local meter_id="$1"
  local existing_price_id
  existing_price_id="$(find_price_by_lookup_key "$USAGE_LOOKUP_KEY")"
  if [ -n "$existing_price_id" ]; then
    echo "Reusing usage price: $existing_price_id" >&2
    printf '%s\n' "$existing_price_id"
    return
  fi

  echo "Creating usage price..." >&2
  stripe_call prices create \
    -d "currency=$CURRENCY" \
    -d "unit_amount_decimal=$USAGE_UNIT_AMOUNT_DECIMAL_CENTS" \
    -d "recurring[interval]=month" \
    -d "recurring[usage_type]=metered" \
    -d "recurring[meter]=$meter_id" \
    -d "product_data[name]=$USAGE_PRODUCT_NAME" \
    -d "product_data[unit_label]=microUSD" \
    -d "lookup_key=$USAGE_LOOKUP_KEY" \
    -d "nickname=LLM usage microdollar" \
    -d "metadata[dokumen_resource]=llm_usage" \
    -d "metadata[billing_contract]=BILLING.md" \
    -d "metadata[usage_unit]=microdollar" | jq -r '.id'
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
require_command stripe
require_command jq
verify_stripe_access

echo "============================================="
echo "  Dokumen AI - Stripe Billing Setup"
echo "============================================="
echo "Currency:           $CURRENCY"
echo "Stripe API version: $STRIPE_API_VERSION"
echo "Developer price:    \$$(format_cents "$DEVELOPER_UNIT_AMOUNT_CENTS")/month"
echo "Analyst price:      \$$(format_cents "$ANALYST_UNIT_AMOUNT_CENTS")/month"
echo "Usage price:        $USAGE_UNIT_AMOUNT_DECIMAL_CENTS cents per microdollar unit"
echo "Meter event name:   $USAGE_METER_EVENT_NAME"
echo "============================================="
echo ""

DEVELOPER_PRICE_ID="$(create_or_get_fixed_price \
  "$DEVELOPER_LOOKUP_KEY" \
  "$DEVELOPER_PRODUCT_NAME" \
  "$DEVELOPER_UNIT_AMOUNT_CENTS" \
  "developer")"

ANALYST_PRICE_ID="$(create_or_get_fixed_price \
  "$ANALYST_LOOKUP_KEY" \
  "$ANALYST_PRODUCT_NAME" \
  "$ANALYST_UNIT_AMOUNT_CENTS" \
  "analyst")"

USAGE_METER_ID="$(create_or_get_meter)"
USAGE_PRICE_ID="$(create_or_get_usage_price "$USAGE_METER_ID")"

echo ""
echo "Add these values to web/.env.local:"
echo ""
cat <<ENV
STRIPE_DEVELOPER_PRICE_ID=$DEVELOPER_PRICE_ID
STRIPE_ANALYST_PRICE_ID=$ANALYST_PRICE_ID
STRIPE_USAGE_PRICE_ID=$USAGE_PRICE_ID
ENV
echo ""
echo "Add this value to workers/.env.local:"
echo ""
cat <<ENV
STRIPE_METER_EVENT_NAME=$USAGE_METER_EVENT_NAME
ENV
echo ""
echo "The workers service needs STRIPE_SECRET_KEY and STRIPE_METER_EVENT_NAME for usage reporting."
