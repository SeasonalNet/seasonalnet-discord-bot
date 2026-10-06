FROM node:22-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392 AS build

ENV COREPACK_HOME=/tmp/corepack
WORKDIR /build

RUN corepack enable && corepack prepare pnpm@11.17.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
RUN pnpm install --frozen-lockfile \
    && pnpm run build \
    && pnpm prune --prod

FROM node:22-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392

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
