import { NextResponse } from "next/server";
import {
  createChangeStream,
  formatChangeEvent,
} from "@/integrations/mongodb/changeStreams";
import { getVehicleStatus } from "@/lib/db/vehicleStatus";

/**
 * GET endpoint that returns a Server-Sent Events (SSE) stream
 * for real-time vehicle_status collection updates.
 */
export async function GET(request) {
  // Create a TransformStream for SSE
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();

  let cleanup = null;
  let heartbeatInterval = null;
  let isClosed = false;

  // Function to send SSE message
  const sendSSE = async (data) => {
    if (isClosed) return;

    try {
      const message = `data: ${JSON.stringify(data)}\n\n`;
      await writer.write(encoder.encode(message));
    } catch (error) {
      // Stream already closed, mark as closed and ignore
      isClosed = true;
    }
  };

  // Function to safely close the writer
  const closeWriter = async () => {
    if (!isClosed) {
      isClosed = true;
      try {
        await writer.close();
      } catch (error) {
        // Already closed, this is expected - silently ignore
      }
    }
  };

  // Initialize the stream
  (async () => {
    try {
      // Send initial vehicle status
      const initialStatus = await getVehicleStatus();
      if (initialStatus) {
        sendSSE({
          type: "initial",
          data: initialStatus,
          timestamp: new Date().toISOString(),
        });
      }

      // Create change stream for vehicle_status collection
      cleanup = await createChangeStream(
        "vehicle_status",
        (change) => {
          if (!isClosed) {
            const formattedChange = formatChangeEvent(change);
            sendSSE({
              type: "change",
              data: formattedChange,
              timestamp: new Date().toISOString(),
            });
          }
        },
        {
          onError: (error) => {
            if (!isClosed) {
              console.error("Change stream error:", error);
              sendSSE({
                type: "error",
                message: error.message,
                timestamp: new Date().toISOString(),
              });
            }
          },
        }
      );

      // Send heartbeat every 30 seconds to keep connection alive
      heartbeatInterval = setInterval(() => {
        if (!isClosed) {
          sendSSE({
            type: "heartbeat",
            timestamp: new Date().toISOString(),
          });
        }
      }, 30000);

      // Handle client disconnect
      request.signal.addEventListener("abort", async () => {
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
          heartbeatInterval = null;
        }
        if (cleanup) {
          await cleanup();
          cleanup = null;
        }
        await closeWriter();
      });
    } catch (error) {
      console.error("Error initializing change stream:", error);
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
      if (!isClosed) {
        sendSSE({
          type: "error",
          message: error.message,
          timestamp: new Date().toISOString(),
        });
      }
      await closeWriter();
    }
  })();

  // Return the stream as SSE response
  return new NextResponse(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
