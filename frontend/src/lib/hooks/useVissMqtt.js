"use client";

import { useState, useRef, useCallback } from "react";
import mqtt from "mqtt";
import { insertVissMessage } from "@/lib/db/messages";

/**
 * Custom hook for managing VISS MQTT connections and message handling.
 * Provides connection management, message sending, and response tracking functionality.
 *
 * @param {string} vin - Vehicle VIN used for MQTT command topics
 * @returns {Object} MQTT state and control functions
 */
export default function useVissMqtt(vin = "MDBAX9C12XYZ1234") {
  const [hostIP, setHostIP] = useState("127.0.0.1");
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [messages, setMessages] = useState([]);
  const [connectionError, setConnectionError] = useState(null);
  const [activeSubscriptions, setActiveSubscriptions] = useState(new Map());

  const clientRef = useRef(null);
  const clientIdRef = useRef(`frontend_${Math.random().toString(16).slice(2, 10)}`);

  /**
   * Adds a new message to the messages array (keeps only last 20 messages)
   */
  const addMessage = useCallback((type, content) => {
    const timestamp = new Date().toLocaleTimeString();
    setMessages((prev) => {
      const newMessage = { type, content, timestamp };
      const updatedMessages = [...prev, newMessage];
      return updatedMessages.slice(-20);
    });
  }, []);

  /**
   * Connects to the MQTT broker
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
        let cleanHost = host.replace(/^(ws|wss):\/\//i, "").replace(/:\d+$/, "");
        const wsUrl = `ws://${cleanHost}:9001`;

        const client = mqtt.connect(wsUrl);

        client.on("connect", () => {
          setIsConnected(true);
          setIsConnecting(false);
          addMessage("system", `Connected to MQTT at ${wsUrl}`);

          // Subscribe to our specific response topic (and quoted variant due to VISSR bug)
          const responseTopic = `frontend/responses/${clientIdRef.current}`;
          client.subscribe([responseTopic, `#`], (err) => {
            if (err) {
              console.error("Subscription error:", err);
            }
          });
        });

        client.on("message", (topic, message) => {
          const payloadString = message.toString();
          
          const cleanTopic = topic.replace(/"/g, '');
          // Filter out irrelevant messages if we received something unexpected
          if (!cleanTopic.startsWith(`frontend/responses/${clientIdRef.current}`)) {
            return;
          }

          addMessage("received", payloadString);

          try {
            const parsedMessage = JSON.parse(payloadString);

            // Insert to MongoDB
            if (typeof insertVissMessage === "function") {
              insertVissMessage(parsedMessage).catch((error) => {
                console.error("MongoDB insertion error:", error);
              });
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
            console.error("Failed to parse message:", error);
          }
        });

        client.on("close", () => {
          setIsConnected(false);
          setIsConnecting(false);
          addMessage("system", "Connection closed");
        });

        client.on("error", (err) => {
          setIsConnecting(false);
          setConnectionError(`MQTT error: ${err.message}`);
          addMessage("error", `MQTT error: ${err.message}`);
        });

        clientRef.current = client;
      } catch (error) {
        setIsConnecting(false);
        setConnectionError(`Connection error: ${error.message}`);
        addMessage("error", `Connection error: ${error.message}`);
      }
    },
    [addMessage]
  );

  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.end();
      clientRef.current = null;
    }
    setIsConnected(false);
    setActiveSubscriptions(new Map());
  }, []);

  const sendMessage = useCallback(
    (message) => {
      if (!isConnected || !clientRef.current) {
        addMessage("error", "Not connected to server");
        return false;
      }

      if (!message.trim()) {
        addMessage("error", "Cannot send empty message");
        return false;
      }

      try {
        const parsedCommand = JSON.parse(message);
        const payload = {
          topic: `frontend/responses/${clientIdRef.current}`,
          request: parsedCommand,
        };

        clientRef.current.publish(`/${vin}/Vehicle`, JSON.stringify(payload));
        addMessage("sent", message); // Showing the original command sent, not the wrapped payload
        return true;
      } catch (error) {
        addMessage("error", `Invalid JSON: ${error.message}`);
        return false;
      }
    },
    [isConnected, addMessage, vin]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const buildGetCommand = useCallback((paths, options = {}) => {
    const path = Array.isArray(paths) ? paths[0] : paths;
    const command = { action: "get", path: path };
    if (options.includeRequestId !== false) command.requestId = Date.now().toString();
    if (options.filter) command.filter = options.filter;
    if (options.authorization) command.authorization = options.authorization;
    if (options.dc) command.dc = options.dc;
    return command;
  }, []);

  const buildSubscribeCommand = useCallback((paths, options = {}) => {
    const path = Array.isArray(paths) ? paths[0] : paths;
    const command = {
      action: "subscribe",
      path: path,
      filter: options.filter || { variant: "timebased", parameter: { period: "10000" } },
    };
    if (options.includeRequestId !== false) command.requestId = Date.now().toString();
    if (options.authorization) command.authorization = options.authorization;
    if (options.dc) command.dc = options.dc;
    return command;
  }, []);

  const buildUnsubscribeCommand = useCallback((subscriptionId, options = {}) => {
    const command = { action: "unsubscribe", subscriptionId: subscriptionId };
    if (options.includeRequestId !== false) command.requestId = Date.now().toString();
    return command;
  }, []);

  const buildSetCommand = useCallback((path, value, options = {}) => {
    const command = { action: "set", path: path, value: value };
    if (options.includeRequestId !== false) command.requestId = Date.now().toString();
    if (options.authorization) command.authorization = options.authorization;
    return command;
  }, []);

  const sendCommand = useCallback(
    (command) => {
      const jsonString = JSON.stringify(command);
      return sendMessage(jsonString);
    },
    [sendMessage]
  );

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

  const setHost = useCallback((newHost) => {
    setHostIP(newHost);
  }, []);

  return {
    hostIP,
    isConnected,
    isConnecting,
    messages,
    connectionError,
    activeSubscriptions,
    connectToHost,
    disconnect,
    sendMessage,
    sendCommand,
    clearMessages,
    setHost,
    unsubscribeFromId,
    buildGetCommand,
    buildSubscribeCommand,
    buildSetCommand,
    buildUnsubscribeCommand,
  };
}
