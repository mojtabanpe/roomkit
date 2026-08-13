# Build from the repo root: docker build -f apps/web/Dockerfile .
# The resulting image is the edge: it terminates TLS, serves all three Angular
# bundles (public app, system dashboard, tenant portal), and reverse-proxies
# /api to NestJS plus the LiveKit subdomain to LiveKit. See
# deploy/nginx/roomkit.conf.

FROM node:24-slim AS build
WORKDIR /workspace

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx nx run-many -t build -p web dashboard tenant --configuration=production --parallel=3

FROM nginx:1.27-alpine AS runtime

RUN rm /etc/nginx/conf.d/default.conf
COPY deploy/nginx/roomkit.conf /etc/nginx/conf.d/roomkit.conf
COPY --from=build /workspace/dist/apps/web/browser /usr/share/nginx/html
COPY --from=build /workspace/dist/apps/dashboard/browser /usr/share/nginx/dashboard
COPY --from=build /workspace/dist/apps/tenant/browser /usr/share/nginx/tenant

EXPOSE 80 443
