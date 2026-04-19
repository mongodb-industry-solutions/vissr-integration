"use client";

import { useState, useRef, useCallback, useEffect } from "react";

/**
 * Custom hook for managing VISS WebSocket connections and message handling.
 * Provides connection management, message sending, and response tracking functionality.
 *
 * @param {string|null} vin - Vehicle VIN bound to the active WebSocket session
 * @param {string} defaultHost - Preferred WebSocket host for the selected vehicle
 * @param {(vin: string | null, message: Object) => Promise<Object>} persistWebSocketMessageAction
 *   Server action used to log raw VISS messages and materialize subscription data.
 * @returns {Object} WebSocket state and control functions
 */
export default function useVissWebSocket(
  vin,
  defaultHost,
  persistWebSocketMessageAction,
) {
  const [hostIP, setHostIP] = useState(defaultHost || "127.0.0.1");
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [messages, setMessages] = useState([]);
  const [connectionError, setConnectionError] = useState(null);
  const [activeSubscriptions, setActiveSubscriptions] = useState(new Map());

  const socketRef = useRef(null);
  const connectedVinRef = useRef(null);
  const connectedHostRef = useRef(null);
  const reconnectTargetRef = useRef(null);
  const warnedVinChangeRef = useRef(null);
  const warnedMissingVinRef = useRef(false);

  /**
   * Adds a new message to the messages array (keeps only last 20 messages)
   * @param {string} type - Message type ('sent', 'received', 'system', 'error')
   * @param {string} content - Message content
   */
  const addMessage = useCallback((type, content) => {
    const timestamp = new Date().toLocaleTimeString();
    setMessages((prev) => {
      const newMessage = { type, content, timestamp };
      const updatedMessages = [...prev, newMessage];
      return updatedMessages.slice(-20); // Keep only last 20 messages (most recent at end)
    });
  }, []);

  const persistIncomingMessage = useCallback(
    async (message, activeVin) => {
      if (typeof persistWebSocketMessageAction !== "function") {
        throw new Error("persistWebSocketMessageAction is not available");
      }

      await persistWebSocketMessageAction(activeVin, message);
    },
    [persistWebSocketMessageAction]
  );

  useEffect(() => {
    if (isConnected || !defaultHost) {
      return;
    }

    setHostIP(defaultHost);
  }, [defaultHost, isConnected]);

  useEffect(() => {
    if (!isConnected) {
      warnedVinChangeRef.current = null;
      return;
    }

    const nextHost = defaultHost || hostIP;
    const vinChanged = vin !== connectedVinRef.current;
    const hostChanged = nextHost !== connectedHostRef.current;

    if (!vinChanged && !hostChanged) {
      warnedVinChangeRef.current = null;
      return;
    }

    const warningKey = `${connectedVinRef.current || "none"}@${
      connectedHostRef.current || "none"
    }->${vin || "none"}@${nextHost || "none"}`;
    if (warnedVinChangeRef.current === warningKey) {
      return;
    }

    warnedVinChangeRef.current = warningKey;
    reconnectTargetRef.current = nextHost;
    addMessage(
      "system",
      `Vehicle selection changed to ${
        vin || "none"
      }. Reconnecting WebSocket so status sync follows the active vehicle.`
    );
    socketRef.current?.close(1000, "Vehicle selection changed");
  }, [addMessage, defaultHost, hostIP, isConnected, vin]);

  /**
   * Connects to the VISS WebSocket server
   * @param {string} host - Host IP address
   */
  const connectToHost = useCallback(
    (host) => {
      if (!host.trim()) {
        setConnectionError("Please enter a host IP address");
        return;
      }

      setIsConnecting(true);
      setConnectionError(null);
      setHostIP(host);
      connectedVinRef.current = vin || null;
      connectedHostRef.current = host || null;
      warnedVinChangeRef.current = null;
      warnedMissingVinRef.current = false;

      try {
        // If the host already contains a port, use it directly. Otherwise, default to 8888 for WebSocket.
        // Also strip any 'ws://' or 'wss://' prefix if the user accidentally included it
        let cleanHost = host.replace(/^(ws|wss):\/\//i, "");
        let wsUrl = cleanHost.includes(":") 
          ? `ws://${cleanHost}` 
          : `ws://${cleanHost}:8888`;
        
        const socket = new WebSocket(wsUrl, "VISS-noenc");

        socket.onopen = () => {
          setIsConnected(true);
          setIsConnecting(false);
          connectedHostRef.current = cleanHost.includes(":")
            ? cleanHost
            : `${cleanHost}:8888`;
          addMessage("system", `Connected to ${wsUrl}`);

          if (connectedVinRef.current) {
            addMessage(
              "system",
              `Vehicle status sync is bound to ${connectedVinRef.current}`
            );
          } else {
            warnedMissingVinRef.current = true;
            addMessage(
              "system",
              "Connected without a selected vehicle. WebSocket messages will be logged, and the connection will refresh automatically when you pick a vehicle."
            );
          }
        };

        socket.onmessage = (event) => {
          addMessage("received", event.data);

          // Parse message once and use for both MongoDB insertion and subscription tracking
          try {
            const parsedMessage = JSON.parse(event.data);

            persistIncomingMessage(
              parsedMessage,
              connectedVinRef.current
            ).catch((error) => {
              console.error("WebSocket persistence error:", error);
              addMessage(
                "error",
                `Failed to persist WebSocket message: ${error.message}`
              );
            });

            if (
              parsedMessage.action === "subscription" &&
              parsedMessage.data &&
              !connectedVinRef.current &&
              !warnedMissingVinRef.current
            ) {
              warnedMissingVinRef.current = true;
              addMessage(
                "system",
                "Skipping vehicle status sync for WebSocket subscription updates because no vehicle was selected when the connection was opened."
              );
            }

            // Track subscription IDs
            if (parsedMessage.subscriptionId && parsedMessage.requestId) {
              setActiveSubscriptions((prev) => {
                const newMap = new Map(prev);
                newMap.set(parsedMessage.subscriptionId, {
                  requestId: parsedMessage.requestId,
                  timestamp: new Date().toLocaleTimeString(),
                });
                return newMap;
              });
            }
          } catch (error) {
            console.error("Failed to parse or store message:", error);
          }
        };

        socket.onclose = (event) => {
          setIsConnected(false);
          setIsConnecting(false);
          socketRef.current = null;
          connectedVinRef.current = null;
          connectedHostRef.current = null;
          warnedVinChangeRef.current = null;
          warnedMissingVinRef.current = false;
          setActiveSubscriptions(new Map());

          if (event.wasClean) {
            addMessage("system", "Connection closed");
          } else {
            addMessage(
              "error",
              `Connection lost: ${event.code} ${
                event.reason || "Unknown error"
              }`
            );
          }
        };

        socket.onerror = () => {
          setIsConnecting(false);
          setConnectionError(`Failed to connect to ${wsUrl}`);
          addMessage("error", `Connection error to ${wsUrl}`);
        };

        socketRef.current = socket;
      } catch (error) {
        setIsConnecting(false);
        setConnectionError(`Connection error: ${error.message}`);
        addMessage("error", `Connection error: ${error.message}`);
      }
    },
    [addMessage, vin, persistIncomingMessage]
  );

  useEffect(() => {
    if (isConnected || isConnecting || !reconnectTargetRef.current) {
      return;
    }

    const nextHost = reconnectTargetRef.current;
    reconnectTargetRef.current = null;
    connectToHost(nextHost);
  }, [connectToHost, isConnected, isConnecting]);

  /**
   * Disconnects from the WebSocket server
   */
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      reconnectTargetRef.current = null;
      socketRef.current.close(1000, "User disconnected");
      socketRef.current = null;
    }
    connectedVinRef.current = null;
    connectedHostRef.current = null;
    warnedVinChangeRef.current = null;
    warnedMissingVinRef.current = false;
    setIsConnected(false);
    setActiveSubscriptions(new Map()); // Clear subscriptions on disconnect
  }, []);

  /**
   * Sends a message through the WebSocket connection
   * @param {string} message - JSON message to send
   */
  const sendMessage = useCallback(
    (message) => {
      if (!isConnected || !socketRef.current) {
        addMessage("error", "Not connected to server");
        return false;
      }

      if (!message.trim()) {
        addMessage("error", "Cannot send empty message");
        return false;
      }

      try {
        // Validate JSON format
        JSON.parse(message);
        socketRef.current.send(message);
        addMessage("sent", message);
        return true;
      } catch (error) {
        addMessage("error", `Invalid JSON: ${error.message}`);
        return false;
      }
    },
    [isConnected, addMessage]
  );

  /**
   * Clears all messages from the display
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  /**
   * Builds VISS command for get operation
   * @param {string|string[]} paths - Signal path(s)
   * @param {Object} options - Additional options (filter, authorization, etc.)
   * @returns {Object} VISS command object
   */
  const buildGetCommand = useCallback((paths, options = {}) => {
    const path = Array.isArray(paths) ? paths[0] : paths;
    const command = {
      action: "get",
      path: path,
    };

    if (options.includeRequestId !== false) {
      command.requestId = Date.now().toString();
    }

    if (options.filter) command.filter = options.filter;
    if (options.authorization) command.authorization = options.authorization;
    if (options.dc) command.dc = options.dc;

    return command;
  }, []);

  /**
   * Builds VISS command for subscribe operation
   * @param {string|string[]} paths - Signal path(s)
   * @param {Object} options - Additional options (filter, authorization, etc.)
   * @returns {Object} VISS command object
   */
  const buildSubscribeCommand = useCallback((paths, options = {}) => {
    const path = Array.isArray(paths) ? paths[0] : paths;
    const command = {
      action: "subscribe",
      path: path,
      filter: options.filter || {
        variant: "timebased",
        parameter: { period: "10000" },
      },
    };

    if (options.includeRequestId !== false) {
      command.requestId = Date.now().toString();
    }

    if (options.authorization) command.authorization = options.authorization;
    if (options.dc) command.dc = options.dc;

    return command;
  }, []);

  /**
   * Builds VISS command for unsubscribe operation
   * @param {string} subscriptionId - Subscription ID to unsubscribe
   * @returns {Object} VISS command object
   */
  const buildUnsubscribeCommand = useCallback(
    (subscriptionId, options = {}) => {
      const command = {
        action: "unsubscribe",
        subscriptionId: subscriptionId,
      };

      if (options.includeRequestId !== false) {
        command.requestId = Date.now().toString();
      }

      return command;
    },
    []
  );

  /**
   * Builds VISS command for set operation
   * @param {string} path - Signal path
   * @param {string} value - Value to set
   * @param {Object} options - Additional options
   * @returns {Object} VISS command object
   */
  const buildSetCommand = useCallback((path, value, options = {}) => {
    const command = {
      action: "set",
      path: path,
      value: value,
    };

    if (options.includeRequestId !== false) {
      command.requestId = Date.now().toString();
    }

    if (options.authorization) command.authorization = options.authorization;

    return command;
  }, []);

  /**
   * Sends a pre-built command object
   * @param {Object} command - VISS command object
   * @returns {boolean} Success status
   */
  const sendCommand = useCallback(
    (command) => {
      const jsonString = JSON.stringify(command);
      return sendMessage(jsonString);
    },
    [sendMessage]
  );

  /**
   * Unsubscribes from a specific subscription
   * @param {string} subscriptionId - Subscription ID to unsubscribe
   * @returns {boolean} Success status
   */
  const unsubscribeFromId = useCallback(
    (subscriptionId) => {
      const command = buildUnsubscribeCommand(subscriptionId);
      const success = sendCommand(command);

      if (success) {
        setActiveSubscriptions((prev) => {
          const newMap = new Map(prev);
          newMap.delete(subscriptionId);
          return newMap;
        });
      }

      return success;
    },
    [buildUnsubscribeCommand, sendCommand]
  );

  /**
   * Changes the host IP address
   * @param {string} newHost - New host IP
   */
  const setHost = useCallback((newHost) => {
    setHostIP(newHost);
  }, []);

  return {
    // State
    hostIP,
    isConnected,
    isConnecting,
    messages,
    connectionError,
    activeSubscriptions,

    // Actions
    connectToHost,
    disconnect,
    sendMessage,
    sendCommand,
    clearMessages,
    setHost,
    unsubscribeFromId,

    // Command builders
    buildGetCommand,
    buildSubscribeCommand,
    buildSetCommand,
    buildUnsubscribeCommand,
  };
}
