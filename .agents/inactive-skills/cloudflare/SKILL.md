---
name: cloudflare
description: Consolidated skill for Cloudflare Tunnel (networking/connectivity) and Cloudflare WAF (Web Application Firewall security). Use for Cloudflare Tunnel and WAF configuration and management. Biases towards retrieval from Cloudflare docs over pre-trained knowledge.
references:
  - tunnel
  - waf
---

# Cloudflare Platform Skill (Tunnel & WAF)

Consolidated skill for configuring and managing Cloudflare Tunnel and Web Application Firewall (WAF).

Your knowledge of Cloudflare Tunnel and WAF APIs, types, limits, and configurations may be outdated. **Prefer retrieval over pre-training** — the references in this skill are starting points, not source of truth.

## Retrieval Sources

Fetch the **latest** information before citing specific numbers, API signatures, or configuration options. Do not rely on baked-in knowledge or these reference files alone.

| Source | How to retrieve | Use for |
|--------|----------------|---------|
| Cloudflare docs | `cloudflare-docs` search tool or `https://developers.cloudflare.com/` | Limits, API reference, compatibility dates/flags |
| Wrangler/Cloudflared config | `https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/` | Config fields, ingress rules, allowed values |
| Product changelogs | `https://developers.cloudflare.com/changelog/` | Recent changes to limits, features, deprecations |

When a reference file and the docs disagree, **trust the docs**.

## Quick Decision Trees

### "I need networking/connectivity"

```
Need networking?
└─ Expose local service to internet → tunnel/
```

### "I need security"

```
Need security?
└─ Web Application Firewall (WAF) → waf/
```

## Product Index

### Networking & Connectivity
| Product | Reference |
|---------|-----------|
| Tunnel | `references/tunnel/` |

### Security
| Product | Reference |
|---------|-----------|
| WAF | `references/waf/` |
