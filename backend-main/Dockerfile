FROM node:22-alpine AS base

# Prisma's Alpine engine requires OpenSSL; retain standard certificate trust.
RUN apk add --no-cache openssl ca-certificates

FROM base AS builder

WORKDIR /app

COPY package*.json ./

COPY prisma ./prisma

# Install exactly the committed npm lock without lifecycle side effects.
RUN npm ci --ignore-scripts

COPY . .

# Generate explicitly while the dev-only Prisma CLI is available.
# Synthetic build URL never connects to an application database.
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:1/build npx --no-install prisma generate

RUN npm run build



FROM base AS production

WORKDIR /app

COPY package*.json ./

COPY prisma ./prisma

# Optional peers include the dev-only Prisma CLI; generated client is copied below.
# Lifecycle scripts stay disabled, so runtime installation cannot generate/migrate.
RUN npm ci --omit=dev --omit=optional --ignore-scripts

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

ENV NODE_ENV=production

# Source/dependencies remain root-owned and readable; temporary writes use /tmp.
USER node

EXPOSE 4000


CMD ["npm", "run", "start:prod"]
