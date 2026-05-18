# Stage 1: Build
FROM node:24-slim AS builder
WORKDIR /app

RUN npm install -g bun@1.3.12

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

# VITE_ vars are baked into the client bundle at build time
ARG VITE_BASE_URL
ARG VITE_STRIPE_PUBLISHABLE_KEY
ENV VITE_BASE_URL=$VITE_BASE_URL
ENV VITE_STRIPE_PUBLISHABLE_KEY=$VITE_STRIPE_PUBLISHABLE_KEY

RUN npm run build

# Stage 2: Runtime
FROM node:24-slim AS runner

RUN groupadd -g 1001 appgroup && \
    useradd -u 1001 -g appgroup -s /bin/false appuser

WORKDIR /app

COPY --from=builder --chown=appuser:appgroup /app/dist ./dist

USER 1001

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD ["node", "-e", "const h=require('http');h.get('http://localhost:3000/api/healthz',r=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"]

# TanStack Start emits a Node server bundle under dist/server.
CMD ["node", "dist/server/server.js"]
