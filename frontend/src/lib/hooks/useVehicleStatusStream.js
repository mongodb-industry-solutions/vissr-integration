"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Custom hook for managing Server-Sent Events connection to vehicle_status change stream.
 * Provides real-time updates when the vehicle_status collection changes in MongoDB.
 *
 * @returns {Object} Vehicle status state and connection information
 */
export default function useVehicleStatusStream() {
  const [vehicleStatus, setVehicleStatus] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const eventSourceRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);

  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 3000; // 3 seconds

  /**
   * Connects to the SSE stream endpoint
   */
  const connect = useCallback(() => {
    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const eventSource = new EventSource("/api/vehicle-status/stream");
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
        console.log("Vehicle status stream connected");
      };

      eventSource.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          switch (message.type) {
            case "initial":
              // Initial vehicle status on connection
              setVehicleStatus(message.data);
              setIsLoading(false);
              setLastUpdate(message.timestamp);
              break;

            case "change":
              // Update from change stream
              if (message.data.document) {
                setVehicleStatus(message.data.document);
                setLastUpdate(message.timestamp);
              }
              break;

            case "heartbeat":
              // Keep-alive heartbeat
              console.log("Heartbeat received");
              break;

            case "error":
              // Error from server
              console.error("Server error:", message.message);
              setError(message.message);
              break;

            default:
              console.warn("Unknown message type:", message.type);
          }
        } catch (err) {
          console.error("Failed to parse SSE message:", err);
        }
      };

      eventSource.onerror = (err) => {
        console.error("EventSource error:", err);
        setIsConnected(false);
        eventSource.close();

        // Attempt to reconnect with exponential backoff
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttemptsRef.current++;
          const delay = RECONNECT_DELAY * reconnectAttemptsRef.current;

          console.log(
            `Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          setError("Failed to connect to vehicle status stream");
          setIsLoading(false);
        }
      };
    } catch (err) {
      console.error("Failed to create EventSource:", err);
      setError(err.message);
      setIsLoading(false);
    }
  }, []);

  /**
   * Disconnects from the SSE stream
   */
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
  }, []);

  // Auto-connect on mount, disconnect on unmount
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    vehicleStatus,
    isConnected,
    isLoading,
    error,
    lastUpdate,
    connect,
    disconnect,
  };
}
