# Build from the repo root: docker build -f apps/api/Dockerfile .
# Debian-based (not alpine) on purpose: bcrypt ships glibc prebuilds, so the
# runtime install stays a download instead of a node-gyp compile.

FROM node:24-slim AS build
WORKDIR /workspace

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# webpack externalises node_modules and writes dist/apps/api/package.json listing
# the exact versions the bundle imports (generatePackageJson in webpack.config.js).
RUN npx nx build api

FROM node:24-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /workspace/dist/apps/api/package.json ./
# `pg` is loaded by name at runtime by TypeORM, so static analysis never sees it
# and it is absent from the generated manifest. Keep the range in sync with the
# root package.json.
RUN npm install --omit=dev --no-audit --no-fund pg@^8.22.0 \
  && npm cache clean --force

COPY --from=build /workspace/dist/apps/api ./

USER node
EXPOSE 3000
CMD ["node", "main.js"]
