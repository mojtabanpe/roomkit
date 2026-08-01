# Build from the repo root: docker build -f apps/web/Dockerfile .
# The resulting image is the edge: it terminates TLS, serves the Angular bundle,
# and reverse-proxies /api to the NestJS container and the LiveKit subdomain to
# the LiveKit container. See deploy/nginx/roomkit.conf.

FROM node:24-slim AS build
WORKDIR /workspace

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx nx build web --configuration=production

FROM nginx:1.27-alpine AS runtime

RUN rm /etc/nginx/conf.d/default.conf
COPY deploy/nginx/roomkit.conf /etc/nginx/conf.d/roomkit.conf
COPY --from=build /workspace/dist/apps/web/browser /usr/share/nginx/html

EXPOSE 80 443
