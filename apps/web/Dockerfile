# syntax=docker/dockerfile:1
# Multi-stage build using `turbo prune` — see
# https://turbo.build/repo/docs/guides/tools/docker
FROM node:20-alpine AS base
RUN npm install -g turbo@2

FROM base AS pruner
WORKDIR /repo
COPY . .
RUN turbo prune @shgap/web --docker

FROM base AS installer
WORKDIR /repo
COPY --from=pruner /repo/out/json/ .
RUN npm install
COPY --from=pruner /repo/out/full/ .
RUN npx turbo run build --filter=@shgap/web

FROM nginx:1.27-alpine AS runner
COPY --from=installer /repo/apps/web/dist /usr/share/nginx/html
# T24/ADR-0033: real /api + /voice-api reverse-proxy rules and SPA-routing
# fallback — the default nginx config had neither, so the containerized
# image could not reach core-api/voice-service, and a hard refresh on any
# client-side route (e.g. /dashboards/shg) would 404. See nginx.conf itself.
COPY apps/web/nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
