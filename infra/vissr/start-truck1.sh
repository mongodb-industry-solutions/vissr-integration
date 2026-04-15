#!/bin/bash

set -euo pipefail

# Create Unix Domain Socket directory
mkdir -p /var/tmp/vissv2
chmod 777 /var/tmp/vissv2

# Start memcached with UNIX socket
echo "Starting memcached..."
memcached -d -u root --unix-mask=755 --unix-socket=/var/tmp/vissv2/memcacheDB.sock

# Wait a moment for memcached to be ready
sleep 1

# Wait for the MQTT broker before starting VISSR, otherwise the MQTT manager
# may miss its one-shot subscription attempt during container startup.
echo "Waiting for MQTT broker..."
until bash -c "exec 3<>/dev/tcp/${MQTT_BROKER_ADDR:-mosquitto}/1883" 2>/dev/null; do
  sleep 1
done

# Install the truck1 runtime config into the server directory before startup.
cp /app/truck1-demo/viss.him /app/server/vissv2server/viss.him
cp /app/truck1-demo/uds-registration.json /app/server/vissv2server/uds-registration.json

# Start the VISS server with memcache, mqtt, and tree defaults populated.
echo "Starting VISSv2 Server with truck1 and trailer1 trees..."
cd /app/server/vissv2server
./vissv2server -s memcache -m -d &

# Wait for the server to be ready
sleep 2

# Start the feeder with a small synthetic truck/trailer dataset.
echo "Starting truck1 synthetic feeder..."
cd /app/feeder/feeder-template/feederv4
./feederv4 -i vssjson -t /app/data/truck1_trailer1_feed.json -d memcache
