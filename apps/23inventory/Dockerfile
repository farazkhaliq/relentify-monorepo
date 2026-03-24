FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

FROM base AS pruner
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN npm install -g turbo
COPY . .
RUN turbo prune inventory --docker

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

FROM base AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=pruner /app/out/full/ .
COPY --from=deps /app/apps/23inventory/node_modules ./apps/23inventory/node_modules
COPY --from=deps /app/packages/ui/node_modules ./packages/ui/node_modules
RUN cd packages/database && npx prisma@5.22.0 generate
RUN cd apps/23inventory && npx prisma@5.22.0 generate --schema ./prisma/schema.prisma
WORKDIR /app/apps/23inventory
RUN pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache openssl
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/apps/23inventory/public ./apps/23inventory/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/23inventory/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/23inventory/.next/static ./apps/23inventory/.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "apps/23inventory/server.js"]
