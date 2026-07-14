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
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
