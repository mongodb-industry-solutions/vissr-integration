#!/bin/bash

set -euo pipefail

required_vars=(
  MQTT_BROKER_ADDR
  MQTT_VEHICLE_VIN
  VEHICLE_PROFILE
  VEHICLE_INDEX
  VEHICLE_ID
  VEHICLE_VISS_HIM
  VEHICLE_UDS_REGISTRATION
  VEHICLE_FEED_JSON
)

for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "Missing required environment variable: ${var_name}" >&2
    exit 1
  fi
done

mkdir -p /var/tmp/vissv2
chmod 777 /var/tmp/vissv2

echo "Starting memcached..."
memcached -d -u root --unix-mask=755 --unix-socket=/var/tmp/vissv2/memcacheDB.sock

sleep 1

echo "Waiting for MQTT broker..."
until bash -c "exec 3<>/dev/tcp/${MQTT_BROKER_ADDR}/1883" 2>/dev/null; do
  sleep 1
done

cp "${VEHICLE_VISS_HIM}" /app/server/vissv2server/viss.him
cp "${VEHICLE_UDS_REGISTRATION}" /app/server/vissv2server/uds-registration.json

echo "Starting VISSv2 Server for ${VEHICLE_PROFILE}:${VEHICLE_ID} (VIN ${MQTT_VEHICLE_VIN})..."
cd /app/server/vissv2server
./vissv2server -s memcache -m -d &

sleep 2

echo "Starting feeder for ${VEHICLE_ID} from ${VEHICLE_FEED_JSON}..."
cd /app/feeder/feeder-template/feederv4
./feederv4 -i vssjson -t "${VEHICLE_FEED_JSON}" -d memcache
