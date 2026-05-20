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
ENV NODE_OPTIONS=--max-old-space-size=3072

RUN npm run build

# Stage 2: Production dependencies
FROM node:24-slim AS prod-deps
WORKDIR /app

RUN npm install -g bun@1.3.12

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Stage 3: Runtime
FROM node:24-slim AS runner

RUN groupadd -g 1001 appgroup && \
    useradd -u 1001 -g appgroup -s /bin/false appuser

WORKDIR /app

COPY --from=prod-deps --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/package.json ./package.json
COPY --from=builder --chown=appuser:appgroup /app/.output ./.output

USER 1001

EXPOSE 3000
ENV HOST=0.0.0.0
ENV NPM_CONFIG_CACHE=/tmp/.npm
ENV PORT=3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD ["node", "-e", "const net=require('net');const s=net.createConnection({host:'127.0.0.1',port:3000},()=>{s.destroy();process.exit(0)});s.on('error',()=>process.exit(1));s.setTimeout(5000,()=>{s.destroy();process.exit(1)})"]

CMD ["node", ".output/server/index.mjs"]
