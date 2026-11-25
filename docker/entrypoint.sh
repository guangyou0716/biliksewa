#!/bin/sh
# Seeds the synthetic demo data on first start when BILIKSEWA_SEED_DEMO=1 and the database file does
# not exist yet. An existing database is never touched.
set -eu
if [ "${BILIKSEWA_SEED_DEMO:-0}" = "1" ] && [ ! -e "$DATABASE_URL" ]; then
	echo "biliksewa: no database at $DATABASE_URL, seeding synthetic demo data"
	node seed/seed.mjs
fi
exec "$@"
