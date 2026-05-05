# Stage 1: Build
FROM oven/bun:1 AS builder
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

# VITE_ vars are baked into the client bundle at build time
ARG VITE_BASE_URL
ARG VITE_STRIPE_PUBLISHABLE_KEY
ENV VITE_BASE_URL=$VITE_BASE_URL
ENV VITE_STRIPE_PUBLISHABLE_KEY=$VITE_STRIPE_PUBLISHABLE_KEY

RUN bun run build

# Stage 2: Runtime
FROM node:22-slim AS runner

RUN groupadd -g 1001 appgroup && \
    useradd -u 1001 -g appgroup -s /bin/false appuser

WORKDIR /app

COPY --from=builder --chown=appuser:appgroup /app/.output ./.output

USER 1001

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD ["node", "-e", "const h=require('http');h.get('http://localhost:3000/api/healthz',r=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"]

# Nitro default node preset outputs a self-contained server bundle
CMD ["node", ".output/server/index.mjs"]
