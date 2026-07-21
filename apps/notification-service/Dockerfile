# syntax=docker/dockerfile:1
# Multi-stage build using `turbo prune` so the final image only contains this
# app's slice of the monorepo (with hoisted deps correctly resolved) — see
# https://turbo.build/repo/docs/guides/tools/docker
FROM node:20-alpine AS base
# Prisma's query engine binary is dynamically linked against OpenSSL, which the
# Alpine base image doesn't ship — needed now that this service depends on
# @shgap/database (T13), same as core-api's Dockerfile.
RUN apk add --no-cache openssl
RUN npm install -g turbo@2

FROM base AS pruner
WORKDIR /repo
COPY . .
RUN turbo prune @shgap/notification-service --docker

FROM base AS installer
WORKDIR /repo
COPY --from=pruner /repo/out/json/ .
RUN npm install
COPY --from=pruner /repo/out/full/ .
RUN npx turbo run build --filter=@shgap/notification-service

FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=installer /repo .
EXPOSE 3001
CMD ["node", "apps/notification-service/dist/main"]
