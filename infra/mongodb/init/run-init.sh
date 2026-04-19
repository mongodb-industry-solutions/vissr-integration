#!/usr/bin/env bash
set -euo pipefail

: "${MONGODB_URI:?MONGODB_URI is required}"

DATABASE_NAME="${DATABASE_NAME:-vissr-integration}"
REPLICA_SET_MODE="${MONGO_INIT_REPLICA_SET_MODE:-none}"
REPLICA_SET_HOST="${MONGO_INIT_REPLICA_SET_HOST:-mongodb:27017}"
SEED_DUMP_DIR="${MONGO_INIT_SEED_DUMP_DIR:-}"
SOURCE_DATABASE_NAME="${MONGO_INIT_SOURCE_DATABASE_NAME:-vissr-integration}"

if [[ "${REPLICA_SET_MODE}" == "local" ]]; then
  mongosh "${MONGODB_URI}" --quiet --eval "try { rs.status() } catch (error) { rs.initiate({_id: \"rs0\", members: [{_id: 0, host: \"${REPLICA_SET_HOST}\"}]}) }"

  until mongosh "${MONGODB_URI}" --quiet --eval "quit(db.hello().isWritablePrimary ? 0 : 1)"; do
    sleep 1
  done

  if [[ -n "${SEED_DUMP_DIR}" ]]; then
    if mongosh "${MONGODB_URI}" --quiet --eval "quit(db.getSiblingDB(\"${DATABASE_NAME}\").getCollectionNames().includes(\"vehicle_status\") ? 0 : 1)"; then
      echo "MongoDB already initialized, skipping local seed restore."
    else
      mongorestore \
        --drop \
        --uri "${MONGODB_URI}" \
        --nsFrom="${SOURCE_DATABASE_NAME}.*" \
        --nsTo="${DATABASE_NAME}.*" \
        "${SEED_DUMP_DIR}"
    fi
  fi
fi

mongosh "${MONGODB_URI}" --quiet "/scripts/bootstrap.js"
