# syntax=docker/dockerfile:1
# Multi-stage build using `turbo prune` so the final image only contains this
# app's slice of the monorepo (with hoisted deps correctly resolved) — see
# https://turbo.build/repo/docs/guides/tools/docker
FROM node:20-alpine AS base
RUN npm install -g turbo@2

FROM base AS pruner
WORKDIR /repo
COPY . .
RUN turbo prune @shgap/core-api --docker

FROM base AS installer
WORKDIR /repo
COPY --from=pruner /repo/out/json/ .
RUN npm install
COPY --from=pruner /repo/out/full/ .
RUN npx turbo run build --filter=@shgap/core-api

FROM node:20-alpine AS runner
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=installer /repo .
EXPOSE 3000
CMD ["node", "apps/core-api/dist/main"]
