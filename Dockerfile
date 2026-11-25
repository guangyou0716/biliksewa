# biliksewa on Node (adapter-node) with SQLite on a volume. See docker-compose.yml and README.
# Build:  docker compose build      Run: docker compose up -d   ->  http://localhost:3000

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# The build opens the database module once; point it at a throwaway file.
RUN DATABASE_URL=/tmp/build.db npm run build \
	&& npx esbuild scripts/seed.ts --bundle --platform=node --format=esm --target=node22 \
		--external:better-sqlite3 --outfile=seed/seed.mjs \
	&& npm prune --omit=dev

FROM node:22-bookworm-slim
ENV NODE_ENV=production \
	PORT=3000 \
	DATABASE_URL=/data/biliksewa.db
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --from=build /app/seed ./seed
# Migrations are applied from ./drizzle when the app opens the database.
COPY --from=build /app/drizzle ./drizzle
COPY docker/entrypoint.sh /usr/local/bin/biliksewa-entrypoint
RUN chmod 0755 /usr/local/bin/biliksewa-entrypoint && mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
	CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/login').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
ENTRYPOINT ["biliksewa-entrypoint"]
CMD ["node", "build"]
