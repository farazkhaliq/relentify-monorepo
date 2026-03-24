# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Prune workspace to only what this app needs
FROM base AS pruner
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN npm install -g turbo
COPY . .
RUN turbo prune auth --docker

# Install dependencies from pruned workspace
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

# Build
FROM base AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=pruner /app/out/full/ .
COPY --from=deps /app/apps/21auth/node_modules ./apps/21auth/node_modules
COPY --from=deps /app/packages/ui/node_modules ./packages/ui/node_modules
# Explicitly copy schema.prisma from build context to override cached pruner output
COPY packages/database/prisma/schema.prisma packages/database/prisma/schema.prisma
# Generate Prisma client into packages/database/dist
RUN cd packages/database && npx prisma@5.22.0 generate
WORKDIR /app/apps/21auth
RUN pnpm build

# Run
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache openssl1.1-compat || apk add --no-cache openssl
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/apps/21auth/public ./apps/21auth/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/21auth/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/21auth/.next/static ./apps/21auth/.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "apps/21auth/server.js"]
