# VISS WebSocket Client - Command Examples

This document provides example VISS commands that can be used with the WebSocket client.

## Connection

1. Enter a host IP address (e.g., `192.168.1.100` or `localhost`)
2. Click "Connect" to establish WebSocket connection to `ws://[host]:8080` using VISS-noenc protocol

## Quick Commands

The interface provides buttons for common VISS operations:

- **Get**: Retrieves current value of a vehicle signal
- **Subscribe**: Subscribes to real-time updates of a vehicle signal
- **Unsubscribe**: Stops subscription to a vehicle signal

## Example JSON Commands

### Get Vehicle Speed

```json
{
  "action": "get",
  "path": "Vehicle.Speed",
  "requestId": "12345"
}
```

### Subscribe to Engine RPM

```json
{
  "action": "subscribe",
  "path": "Vehicle.Powertrain.ICE.Engine.Speed",
  "requestId": "67890"
}
```

### Unsubscribe from Engine RPM

```json
{
  "action": "unsubscribe",
  "path": "Vehicle.Powertrain.ICE.Engine.Speed",
  "requestId": "67890"
}
```

### Get All Available Signals

```json
{
  "action": "get",
  "path": "Vehicle",
  "requestId": "list-all"
}
```

### Get Vehicle Location

```json
{
  "action": "get",
  "path": "Vehicle.CurrentLocation",
  "requestId": "location-123"
}
```

### Subscribe to Vehicle Position

```json
{
  "action": "subscribe",
  "path": "Vehicle.CurrentLocation.Latitude",
  "requestId": "lat-sub"
}
```

## Features

- **Real-time messaging**: See sent and received messages with timestamps
- **JSON validation**: Commands are validated before sending
- **Connection status**: Visual indicator of connection state
- **Message history**: Scrollable log of all communication
- **Quick commands**: Pre-built templates for common operations
- **Error handling**: Clear error messages for connection and parsing issues

## Protocol Support

- WebSocket protocol: `VISS-noenc` (unencrypted VISS)
- Default port: `8080`
- Message format: JSON

## Keyboard Shortcuts

- `Ctrl+Enter` (or `Cmd+Enter` on Mac): Send command from text area
