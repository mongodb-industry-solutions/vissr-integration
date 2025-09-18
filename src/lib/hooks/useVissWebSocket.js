"use client";

import { useState, useRef, useCallback } from "react";

/**
 * Custom hook for managing VISS WebSocket connections and message handling.
 * Provides connection management, message sending, and response tracking functionality.
 *
 * @returns {Object} WebSocket state and control functions
 */
export default function useVissWebSocket() {
  const [hostIP, setHostIP] = useState("127.0.0.1");
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [messages, setMessages] = useState([]);
  const [connectionError, setConnectionError] = useState(null);
  const [activeSubscriptions, setActiveSubscriptions] = useState(new Map());

  const socketRef = useRef(null);

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

      try {
        const wsUrl = `ws://${host}:8080`;
        const socket = new WebSocket(wsUrl, "VISS-noenc");

        socket.onopen = () => {
          setIsConnected(true);
          setIsConnecting(false);
          addMessage("system", `Connected to ${host}:8080`);
        };

        socket.onmessage = (event) => {
          addMessage("received", event.data);

          // Track subscription IDs from responses
          try {
            const response = JSON.parse(event.data);
            if (response.subscriptionId && response.requestId) {
              setActiveSubscriptions((prev) => {
                const newMap = new Map(prev);
                newMap.set(response.subscriptionId, {
                  requestId: response.requestId,
                  timestamp: new Date().toLocaleTimeString(),
                });
                return newMap;
              });
            }
          } catch (error) {
            // Ignore JSON parsing errors for subscription tracking
          }
        };

        socket.onclose = (event) => {
          setIsConnected(false);
          setIsConnecting(false);
          socketRef.current = null;

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
          setConnectionError(`Failed to connect to ${host}:8080`);
          addMessage("error", `Connection error to ${host}:8080`);
        };

        socketRef.current = socket;
      } catch (error) {
        setIsConnecting(false);
        setConnectionError(`Connection error: ${error.message}`);
        addMessage("error", `Connection error: ${error.message}`);
      }
    },
    [addMessage]
  );

  /**
   * Disconnects from the WebSocket server
   */
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close(1000, "User disconnected");
      socketRef.current = null;
    }
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
