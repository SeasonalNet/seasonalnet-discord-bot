FROM node:22-bookworm-slim@sha256:de170b39439eb0e5a3444ad7d60b015614a381e10fecae2e30ec9e735122f38d AS build

ENV COREPACK_HOME=/tmp/corepack
WORKDIR /build

RUN corepack enable && corepack prepare pnpm@11.17.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
RUN pnpm install --frozen-lockfile \
    && pnpm run build \
    && pnpm prune --prod

FROM node:22-bookworm-slim@sha256:de170b39439eb0e5a3444ad7d60b015614a381e10fecae2e30ec9e735122f38d AS runtime-files

ENV NODE_ENV=production \
    SEASONALNET_BOT_CONFIG=/run/config/seasonalnet-discord-bot.yaml

RUN groupadd --system --gid 10001 seasonalbot \
    && useradd --system --uid 10001 --gid 10001 --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin seasonalbot \
    && mkdir -p /run/config \
    && install -d -o 10001 -g 10001 -m 0700 /var/lib/seasonalnet/discord-bot

WORKDIR /app
COPY --from=build --chown=0:0 /build/package.json ./package.json
COPY --from=build --chown=0:0 /build/node_modules ./node_modules
COPY --from=build --chown=0:0 /build/dist ./dist

RUN rm -rf /app/dist/scripts /app/node_modules/.bin

RUN chmod -R go-w /app

FROM gcr.io/distroless/nodejs22-debian13:nonroot@sha256:b0b1352373f14fe86376d423e6d283ea6b85b912ff55ca89bed8d2fe11c257b8 AS runtime
USER 0
ENV PATH=/nodejs/bin
ENV NODE_ENV=production SEASONALNET_BOT_CONFIG=/run/config/seasonalnet-discord-bot.yaml
WORKDIR /app
COPY --from=runtime-files --chown=0:0 /app /app
COPY --from=runtime-files --chown=10001:10001 /var/lib/seasonalnet/discord-bot /var/lib/seasonalnet/discord-bot
RUN ["/nodejs/bin/node", "-e", "const fs=require('node:fs'); fs.chownSync('/app',0,0); fs.chmodSync('/app',0o755);"]
USER 10001:10001
ENTRYPOINT []
CMD ["/nodejs/bin/node", "dist/src/index.js"]
RUN ["/nodejs/bin/node", "-e", "const fs=require('node:fs'); if(process.getuid()===0 || fs.statSync('/app/package.json').uid!==0) process.exit(1); for(const p of ['/app/package.json','/app']) { let writable=true; try { fs.accessSync(p,fs.constants.W_OK); } catch { writable=false; } if(writable) process.exit(1); }"]
