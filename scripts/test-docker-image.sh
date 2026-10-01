#!/usr/bin/env bash
set -euo pipefail

app="$1"
image="$2"
prefix="oneglanse-ci-$app-$$"
containers=()
test_password="$(openssl rand -hex 24)"

cleanup() {
  result=$?
  if [ "$result" -ne 0 ]; then
    for container in "${containers[@]}"; do
      docker logs "$container" || true
    done
  fi
  for container in "${containers[@]}"; do
    docker rm -f -v "$container" >/dev/null 2>&1 || true
  done
  docker network rm "$prefix" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# All data and credentials belong to this test. Block external API traffic.
docker network create --internal "$prefix" >/dev/null
containers+=("$prefix-redis")
docker run -d --name "$prefix-redis" --network "$prefix" --network-alias redis \
  redis:7-alpine redis-server --requirepass "$test_password" >/dev/null

case "$app" in
  web)
    docker run --rm --network none --entrypoint sh "$image" -ec '
      test -s /app/apps/web/server.js
      test -d /app/apps/web/.next/static
      test -d /app/apps/web/public
      test -d /workspace/packages/db/drizzle
      cd /app/apps/web
      node -e "require.resolve(\"next\"); require.resolve(\"react\")"
      cd /workspace
      pnpm --filter @oneglanse/db exec node -e "require.resolve(\"drizzle-orm\"); require.resolve(\"pg\")"
    '
    docker build -f packages/db/Dockerfile -t oneglanse-postgres:ci .
    containers+=("$prefix-db" "$prefix-clickhouse")
    docker run -d --name "$prefix-db" --network "$prefix" --network-alias db \
      -e "POSTGRES_PASSWORD=$test_password" -e POSTGRES_DB=oneglanse \
      -v "$PWD/packages/db/init-scripts:/docker-entrypoint-initdb.d:ro" \
      oneglanse-postgres:ci postgres -c shared_preload_libraries=pg_cron \
      -c cron.database_name=oneglanse >/dev/null
    docker run -d --name "$prefix-clickhouse" --network "$prefix" --network-alias clickhouse \
      -e CLICKHOUSE_USER=default -e "CLICKHOUSE_PASSWORD=$test_password" -e CLICKHOUSE_DB=oneglanse \
      -e CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT=1 \
      -v "$PWD/packages/db/clickhouse-init:/docker-entrypoint-initdb.d:ro" \
      clickhouse/clickhouse-server:latest >/dev/null
    ready=false
    for _ in {1..60}; do
      if docker exec "$prefix-db" pg_isready -U postgres -d oneglanse >/dev/null 2>&1 && \
        docker exec "$prefix-clickhouse" clickhouse-client --password "$test_password" --query 'SELECT 1' >/dev/null 2>&1; then
        ready=true
        break
      fi
      sleep 1
    done
    test "$ready" = true
    docker run --rm --network "$prefix" -e "DATABASE_URL=postgresql://postgres:$test_password@db:5432/oneglanse" \
      -w /workspace "$image" pnpm --filter @oneglanse/db db:migrate
    containers+=("$prefix-web")
    docker run -d --name "$prefix-web" --network "$prefix" --network-alias web \
      -e HOSTNAME=0.0.0.0 -e APP_URL=http://localhost:3000 \
      -e ONEGLANSE_APP_MODE=self-host \
      -e "BETTER_AUTH_SECRET=$test_password" \
      -e "INTERNAL_CRON_SECRET=$test_password" -e API_BASE_URL=http://web:3000 \
      -e "DATABASE_URL=postgresql://postgres:$test_password@db:5432/oneglanse" \
      -e REDIS_HOST=redis -e "REDIS_PASSWORD=$test_password" \
      -e CLICKHOUSE_URL=http://clickhouse:8123 \
      -e CLICKHOUSE_USER=default -e "CLICKHOUSE_PASSWORD=$test_password" -e CLICKHOUSE_DB=oneglanse \
      "$image" >/dev/null
    docker exec -i "$prefix-web" node --input-type=module < scripts/test-web-image.mjs
    ;;
  agent)
    docker run --rm --network none --entrypoint sh "$image" -ec '
      test -x /usr/local/bin/start-worker
      test -s /app/dist/index.js
      node -e "require.resolve(\"playwright-core\"); require.resolve(\"bullmq\")"
      python3 - <<"PY"
from camoufox.addons import DefaultAddons
from camoufox.sync_api import Camoufox

with Camoufox(headless=True, exclude_addons=list(DefaultAddons)) as browser:
    page = browser.new_page()
    page.set_content("<title>OneGlanse image test</title>")
    assert page.title() == "OneGlanse image test"
PY
    '
    containers+=("$prefix-agent")
    docker run -d --name "$prefix-agent" --network "$prefix" \
      -e REDIS_HOST=redis -e "REDIS_PASSWORD=$test_password" \
      -e "DATABASE_URL=postgresql://postgres:$test_password@db:5432/oneglanse" \
      -e CLICKHOUSE_USER=default -e "CLICKHOUSE_PASSWORD=$test_password" -e CLICKHOUSE_DB=oneglanse \
      "$image" >/dev/null
    docker exec -i "$prefix-agent" node --input-type=module <<'JS'
import assert from 'node:assert/strict';
import { setTimeout } from 'node:timers/promises';
import { getProviderQueue } from '@oneglanse/services';
import { PROVIDER_LIST } from '@oneglanse/types';

for (let attempt = 0; attempt < 60; attempt++) {
  try {
    const response = await fetch('http://localhost:3333/health');
    assert.equal((await response.json()).status, 'ok');
    for (const provider of PROVIDER_LIST) {
      const workers = await getProviderQueue(provider).getWorkers();
      assert.equal(workers.length, 1, `${provider} worker must start`);
    }
    console.log('Agent API and all provider workers started');
    process.exit(0);
  } catch (error) {
    if (attempt === 59) throw error;
    await setTimeout(1000);
  }
}
JS
    ;;
  *)
    echo "Unsupported app: $app" >&2
    exit 1
    ;;
esac
