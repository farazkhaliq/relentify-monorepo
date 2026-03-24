FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

FROM base AS pruner
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN npm install -g turbo
COPY . .
RUN turbo prune crm --docker

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
COPY --from=deps /app/apps/25crm/node_modules ./apps/25crm/node_modules
COPY --from=deps /app/packages/ui/node_modules ./packages/ui/node_modules
RUN cd packages/database && npx prisma@5.22.0 generate
WORKDIR /app/apps/25crm
RUN pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/apps/25crm/public ./apps/25crm/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/25crm/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/25crm/.next/static ./apps/25crm/.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "apps/25crm/server.js"]
