"use client";

import React, { useEffect, useRef } from "react";
import { H3, Body } from "@leafygreen-ui/typography";
import Button from "@leafygreen-ui/button";
import Code from "@leafygreen-ui/code";
import { palette } from "@leafygreen-ui/palette";
import Icon from "@leafygreen-ui/icon";

/**
 * MessagesLog
 *
 * Displays a scrollable list of messages with basic formatting, and a clear action.
 */
export default function MessagesLog({ messages, onClear }) {
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const formatMessage = (message) => {
    try {
      const parsed = JSON.parse(message.content);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return message.content;
    }
  };

  const getMessageTypeColor = (type) => {
    switch (type) {
      case "sent":
        return palette.blue.base;
      case "received":
        return palette.green.base;
      case "system":
        return palette.gray.dark1;
      case "error":
        return palette.red.base;
      default:
        return palette.gray.base;
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <H3>Messages</H3>
        <Button
          size="small"
          variant="default"
          onClick={onClear}
          disabled={messages.length === 0}
          leftGlyph={<Icon glyph="Trash" />}
        >
          Clear
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-50 rounded-lg p-4">
        {messages.length === 0 ? (
          <Body className="text-gray-500 text-center py-8">
            No messages yet. Connect to a server and send commands to see
            responses.
          </Body>
        ) : (
          <div className="space-y-3">
            {messages.map((message, index) => (
              <div
                key={index}
                className="border-l-4 pl-4 py-2 bg-white rounded"
                style={{ borderColor: getMessageTypeColor(message.type) }}
              >
                <div className="flex items-center justify-between mb-1">
                  <Body
                    className="text-sm font-medium capitalize"
                    style={{ color: getMessageTypeColor(message.type) }}
                  >
                    {message.type === "sent" && "→ Sent"}
                    {message.type === "received" && "← Received"}
                    {message.type === "system" && "● System"}
                    {message.type === "error" && "⚠ Error"}
                  </Body>
                  <Body className="text-xs text-gray-500">
                    {message.timestamp}
                  </Body>
                </div>

                {message.type === "system" || message.type === "error" ? (
                  <Body className="text-sm">{message.content}</Body>
                ) : (
                  <Code language="json" className="text-xs">
                    {formatMessage(message)}
                  </Code>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}
