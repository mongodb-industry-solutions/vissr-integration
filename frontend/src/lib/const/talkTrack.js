export const TALK_TRACK = [
  {
    heading: "Storyline",
    content: [
      {
        heading: "What we are showing",
        body: "A small fleet of two trucks (each tractor + trailer) streaming VISS telemetry into MongoDB. A cloud ML model detects tire incidents and a human dispatches the alert back to the driver — closing the loop in real time.",
      },
      {
        heading: "Demo flow",
        body: [
          "Start on the Home page to set the scene and review the architecture.",
          "Open the Sandbox to inspect the raw VISS connection — get / set / subscribe over MQTT or WebSocket for any vehicle.",
          "Switch to the Fleet view, point out tire pressure / temperature for both tractors and trailers, and approve one of the pending alerts.",
          "Move to the Driver view to show the banner appearing on the cabin display, then click Acknowledge to clear the warning.",
          "Open the Logs drawer at any point to show every VISS command flowing in and out.",
        ],
      },
    ],
  },
  {
    heading: "Behind the scenes",
    content: [
      {
        heading: "What is wired up",
        body: "The persistent shell holds a single global MQTT client. Fleet and Driver views consume the live MongoDB vehicle_status documents through Server-Sent Events backed by MongoDB change streams.",
      },
      {
        heading: "Outbound commands",
        body: "When you approve an alert, the global MQTT client publishes a VISS set command to /<VIN>/Vehicle. The bridge persists the result, the change stream broadcasts it, and the Driver view paints the banner.",
      },
      {
        image: {
          src: "/architecture.svg",
          alt: "Architecture diagram",
        },
      },
    ],
  },
  {
    heading: "Why MongoDB?",
    content: [
      {
        heading: "Flexible document model",
        body: "VSS signals are deeply nested and evolving — a document model maps onto them without rigid schemas or JOIN gymnastics.",
      },
      {
        heading: "Change streams + SSE",
        body: "Live dashboards without polling. The same materialised collection feeds both the fleet manager and the driver views.",
      },
      {
        heading: "Time-series ready",
        body: "Every signal is also written to a telemetry collection — ready for time-series analytics, anomaly detection, and ML pipelines.",
      },
    ],
  },
];
