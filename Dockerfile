FROM node:24-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS build

ENV COREPACK_HOME=/tmp/corepack
WORKDIR /build

RUN corepack enable && corepack prepare pnpm@12.15.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
RUN pnpm install --frozen-lockfile
COPY src ./src
COPY tools ./tools
COPY scripts ./scripts
ARG APP_VERSION=0.0.0+unknown
ARG APP_REVISION=unknown
ENV APP_VERSION=${APP_VERSION} APP_REVISION=${APP_REVISION}

RUN pnpm run build \
    && pnpm prune --prod

FROM node:24-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS runtime-files

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

ARG APP_VERSION=0.0.0+unknown
ARG APP_REVISION=unknown
ENV APP_VERSION=${APP_VERSION} APP_REVISION=${APP_REVISION}

RUN node -e "const fs=require('node:fs'); const p=JSON.parse(fs.readFileSync('package.json','utf8')); p.version=process.env.APP_VERSION; fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\\n');"

RUN chmod -R go-w /app

FROM gcr.io/distroless/nodejs22-debian13:nonroot@sha256:10747a1323be68f206aed893599d43e6697ad67257e7c42703553f99fbce3d33 AS runtime

ARG APP_VERSION=0.0.0+unknown
ARG APP_REVISION=unknown
ENV APP_VERSION=${APP_VERSION} APP_REVISION=${APP_REVISION}
LABEL org.opencontainers.image.version="${APP_VERSION}" org.opencontainers.image.revision="${APP_REVISION}"

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
