FROM golang:1.22 AS builder
WORKDIR /build

# Clone the repository and checkout the specific commit
RUN git clone https://github.com/COVESA/vissr.git . && \
    git checkout ad53564 && \
    sed -i 's/FVTAddr := "test.mosquitto.org"/FVTAddr := os.Getenv("MQTT_BROKER_ADDR")/' server/vissv2server/mqttMgr/mqttMgr.go && \
    sed -i 's/vin := extractVin(string(response))/vin := os.Getenv("MQTT_VEHICLE_VIN"); if vin == "" { vin = extractVin(string(response)) }/' server/vissv2server/mqttMgr/mqttMgr.go

# Build the server
WORKDIR /build/server/vissv2server
RUN go build -o vissv2server .

# Build the feeder
WORKDIR /build/feeder/feeder-template/feederv4
RUN go build -o feederv4 .

# Create the final runtime image
FROM debian:bookworm-slim

# Install necessary utilities and memcached
RUN apt-get update && apt-get install -y \
    net-tools \
    procps \
    ca-certificates \
    memcached \
    && rm -rf /var/lib/apt/lists/*
RUN update-ca-certificates

WORKDIR /app

# Copy the built server binary and its dependencies
RUN mkdir -p /app/server/vissv2server
COPY --from=builder /build/server/vissv2server/vissv2server /app/server/vissv2server/
# Copy the entire server directory to get configs like signaldimension.json, vissv3.0-schema.json, etc.
COPY --from=builder /build/server /app/server

# Copy the built feeder binary and its dependencies
RUN mkdir -p /app/feeder/feeder-template/feederv4
COPY --from=builder /build/feeder/feeder-template/feederv4/feederv4 /app/feeder/feeder-template/feederv4/
# Copy the entire feeder directory to get configs
COPY --from=builder /build/feeder /app/feeder

# Add startup script
COPY start.sh /app/start.sh
COPY start-truck1.sh /app/start-truck1.sh
RUN chmod +x /app/start.sh /app/start-truck1.sh

# Add truck1 demo runtime assets
RUN mkdir -p /app/truck1-demo
COPY truck1-viss.him /app/truck1-demo/viss.him
COPY config/uds-registration-truck1.json /app/truck1-demo/uds-registration.json
COPY amm-demo-trees/truck1.binary /app/server/vissv2server/forest/truck1.binary
COPY amm-demo-trees/trailer1.binary /app/server/vissv2server/forest/trailer1.binary

# Create the required Unix Domain Socket directory used for communication
RUN mkdir -p /var/tmp/vissv2

# Expose standard VISS ports (8888 for WebSocket, 8090 for HTTP, 8081 for HTTPS)
EXPOSE 8888 8090 8081

ENTRYPOINT ["/app/start.sh"]
