# syntax=docker/dockerfile:1

# Debian and Ubuntu, not Alpine: onnxruntime-node (background removal on model
# photos, src/modules/files/background.ts) and CUDA ship glibc builds only.

# ---- deps (all) ---------------------------------------------------------------
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# ---- deps (production only, used for `prisma migrate deploy` at runtime) ----
FROM node:22-bookworm-slim AS deps-prod
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
# onnxruntime's CUDA provider is too large for npm; its install script fetches it from NuGet.
RUN node node_modules/onnxruntime-node/script/install --onnxruntime-node-install=cuda12

# ---- build ------------------------------------------------------------------
FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# DATABASE_URL is not needed to generate the client or build the app.
RUN npx prisma generate && npm run build

# ---- runtime ----------------------------------------------------------------
# CUDA 13 (what onnxruntime 1.31 is built against, despite its "cuda12" install flag) and
# cuDNN for its GPU provider; 13.0 matches the 580 driver. Node comes from the official image.
FROM nvidia/cuda:13.0.2-cudnn-runtime-ubuntu24.04 AS runtime
COPY --from=node:22-bookworm-slim /usr/local/bin/node /usr/local/bin/node
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# poppler-utils provides pdftoppm for PDF thumbnails (Phase 4).
# libreoffice-writer turns Word plan documents into PDFs (src/lib/office-convert.ts);
# Carlito and Liberation stand in for Calibri, Arial and Times so layouts hold.
# wget is for the healthcheck. The app user keeps the ids it had on Alpine (100:101),
# so files already in the uploads volume stay writable.
RUN apt-get update && \
    apt-get install -y --no-install-recommends poppler-utils libreoffice-writer fonts-crosextra-carlito fonts-liberation fonts-dejavu-core wget ca-certificates && \
    rm -rf /var/lib/apt/lists/* && \
    groupadd -o -g 101 app && useradd -o -u 100 -g app -d /home/app -m -s /usr/sbin/nologin app

# BiRefNet (MIT) cuts the background out of model photos when BG_REMOVE_DEVICE is set
# (docker-compose.gpu.yml). About 1 GB, fetched once and cached by the build.
ADD --checksum=sha256:58f621f00f5d756097615970a88a791584600dcf7c45b18a0a6267535a1ebd3c --chmod=755 \
    https://github.com/danielgatis/rembg/releases/download/v0.0.0/BiRefNet-general-epoch_244.onnx /models/birefnet-general.onnx
ENV BG_REMOVE_MODEL=/models/birefnet-general.onnx

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
# First admin on a fresh server (the dev seed needs tsx and src/, which this image does not have).
COPY --from=build --chown=app:app /app/scripts/create-admin.mjs ./scripts/create-admin.mjs

RUN mkdir -p /data/uploads && chown -R app:app /data && chmod +x ./docker-entrypoint.sh

USER app
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
