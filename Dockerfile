# syntax=docker/dockerfile:1

# ---- deps (all) ---------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# ---- deps (production only, used for `prisma migrate deploy` at runtime) ----
FROM node:22-alpine AS deps-prod
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# ---- build ------------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# DATABASE_URL is not needed to generate the client or build the app.
RUN npx prisma generate && npm run build

# ---- runtime ----------------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# poppler-utils provides pdftoppm for PDF thumbnails (Phase 4).
RUN apk add --no-cache poppler-utils && \
    addgroup -S app && adduser -S app -G app

# Production node_modules first (Prisma CLI + deps for migrations), then the
# traced standalone output on top of it.
COPY --from=deps-prod --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public

# Schema, migrations and config so the container can run `migrate deploy`.
COPY --from=build --chown=app:app /app/prisma ./prisma
COPY --from=build --chown=app:app /app/prisma.config.ts ./prisma.config.ts
COPY --from=build --chown=app:app /app/docker-entrypoint.sh ./docker-entrypoint.sh

RUN mkdir -p /data/uploads && chown -R app:app /data && chmod +x ./docker-entrypoint.sh

USER app
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
