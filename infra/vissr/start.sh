#!/bin/bash

# Create Unix Domain Socket directory
mkdir -p /var/tmp/vissv2
chmod 777 /var/tmp/vissv2

# Start memcached with UNIX socket
echo "Starting memcached..."
memcached -d -u root --unix-mask=755 --unix-socket=/var/tmp/vissv2/memcacheDB.sock

# Wait a moment for memcached to be ready
sleep 1

# Start the VISS server with memcache
echo "Starting VISSv2 Server..."
cd /app/server/vissv2server
./vissv2server -s memcache &

# Wait for the server to be ready
sleep 2

# Start the feeder with vssjson source, memcache db, and the mounted trip data
# The json file is expected to be mounted at /app/data/zod_drive_000011_vss.json
echo "Starting feederv4..."
cd /app/feeder/feeder-template/feederv4
./feederv4 -i vssjson -t /app/data/zod_drive_000011_vss.json -d memcache
