FROM node:22-bookworm-slim@sha256:43ac6c60b8f89723f746e8a92ce91abd5017e627ce1ddfe4238355d3a30b772c AS build

ENV COREPACK_HOME=/tmp/corepack
WORKDIR /build

RUN corepack enable && corepack prepare pnpm@11.17.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
RUN pnpm install --frozen-lockfile \
    && pnpm run build \
    && pnpm prune --prod

FROM node:22-bookworm-slim@sha256:43ac6c60b8f89723f746e8a92ce91abd5017e627ce1ddfe4238355d3a30b772c

ENV NODE_ENV=production \
    SEASONALNET_BOT_CONFIG=/run/config/seasonalnet-discord-bot.yaml

RUN groupadd --system --gid 10001 seasonalbot \
    && useradd --system --uid 10001 --gid 10001 --create-home --home-dir /home/seasonalbot seasonalbot \
    && mkdir -p /run/config

WORKDIR /app
COPY --from=build --chown=10001:10001 /build/package.json ./package.json
COPY --from=build --chown=10001:10001 /build/node_modules ./node_modules
COPY --from=build --chown=10001:10001 /build/dist ./dist

USER 10001:10001

CMD ["node", "dist/src/index.js"]
