"use client";

import { useState } from "react";
import Link from "next/link";
import Card from "@leafygreen-ui/card";
import Button from "@leafygreen-ui/button";
import Badge from "@leafygreen-ui/badge";
import Icon from "@leafygreen-ui/icon";
import IconButton from "@leafygreen-ui/icon-button";
import Modal from "@leafygreen-ui/modal";
import { Body, H1, H2, H3, Subtitle } from "@leafygreen-ui/typography";
import { palette } from "@leafygreen-ui/palette";
import { useFleetData } from "@/lib/context/FleetDataContext";
import { useAlerts } from "@/lib/context/AlertsContext";
import { useGlobalConnection } from "@/lib/context/GlobalConnectionContext";

const FEATURES = [
  {
    icon: "Database",
    title: "Open COVESA VISS",
    body: "COVESA VISS over COVESA VISSR, with the VSS catalogue as the shared vocabulary.",
  },
  {
    icon: "Cloud",
    title: "Fleet-scale ingestion",
    body: "VISSR simulators publish over MQTT. A bridge service materialises every signal into MongoDB collections in near real-time.",
  },
  {
    icon: "Refresh",
    title: "Real-time change streams",
    body: "MongoDB change streams + SSE keep dashboards live for fleet managers and drivers, no polling required.",
  },
  {
    icon: "Connect",
    title: "Bidirectional commands",
    body: "Approved alerts flow back to the truck via VISS set commands — straight to the driver's infotainment screen.",
  },
];

const STORYLINE = [
  {
    step: "01",
    href: "/sandbox",
    cta: "Open Sandbox",
    title: "Sandbox",
    description:
      "Explore the integration in raw form. Pick a vehicle, send VISS get / set / subscribe commands, and watch responses stream in over MQTT or WebSocket.",
  },
  {
    step: "02",
    href: "/fleet",
    cta: "Open Fleet view",
    title: "Fleet management",
    description:
      "Watch live tire pressure and temperature for every truck. Review alerts raised by the cloud ML model, edit the suggested driver message, and dispatch with one click.",
  },
  {
    step: "03",
    href: "/driver",
    cta: "Open Driver view",
    title: "Driver infotainment",
    description:
      "See exactly what the driver sees. Dispatched warnings show up as a banner the driver can acknowledge — closing the loop back to MongoDB.",
  },
];

function MetricTile({ label, value, hint }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-gray-900">{value}</div>
      {hint ? <div className="text-xs text-gray-500">{hint}</div> : null}
    </div>
  );
}

function WalkDemoModal({ open, setOpen }) {
  return (
    <Modal open={open} setOpen={setOpen} size="large">
      <div className="space-y-5">
        <div>
          <H2>Walk the demo</H2>
          <Body className="text-gray-600">
            A short, 5-minute tour. Each page builds on the previous one and
            shares the same global connection &amp; live data.
          </Body>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {STORYLINE.map((item) => (
            <Card key={item.title} className="flex h-full flex-col p-4">
              <Subtitle className="font-mono !text-xs !text-gray-400">
                {item.step}
              </Subtitle>
              <H3 className="mt-1 !text-base">{item.title}</H3>
              <Body className="mt-2 flex-1 text-sm text-gray-600">
                {item.description}
              </Body>
              <div className="mt-4">
                <Link href={item.href}>
                  <Button
                    variant="default"
                    size="small"
                    rightGlyph={<Icon glyph="ArrowRight" />}
                    onClick={() => setOpen(false)}
                  >
                    {item.cta}
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 md:grid-cols-[2fr_1fr]">
          <div>
            <H3 className="!text-base">How the loop closes</H3>
            <Body className="mt-2 text-sm text-gray-600">
              The cloud ML model sits between MongoDB telemetry and the fleet
              manager. When it detects an incident, it raises an alert. A human
              reviews and dispatches the alert as a VISS{" "}
              <code className="rounded bg-white px-1">set</code> command on the
              driver message branch. The driver acknowledges, the warning
              clears, and the new state is materialised back into MongoDB.
            </Body>
          </div>
          <div className="rounded-lg bg-white p-4 text-sm shadow-sm">
            <div className="font-semibold text-gray-700">Try this:</div>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-gray-700">
              <li>Open the Fleet view and approve a pending alert.</li>
              <li>Switch to the Driver view and watch the banner appear.</li>
              <li>Open the Logs drawer to see every VISS command sent.</li>
            </ol>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function ArchitectureModal({ open, setOpen }) {
  return (
    <Modal open={open} setOpen={setOpen} size="large">
      <div className="space-y-3">
        <H2>Architecture</H2>
        <Body className="text-gray-600">
          End-to-end view: VISSR simulators on each truck publish telemetry over
          MQTT, a bridge materialises signals into MongoDB, and approved alerts
          flow back as VISS set commands.
        </Body>
        <div className="overflow-auto rounded-lg border border-gray-200 bg-white p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/architecture.svg"
            alt="Detailed architecture diagram"
            className="mx-auto block h-auto w-full"
            style={{
              maxWidth: 1600,
              imageRendering: "auto",
            }}
          />
        </div>
      </div>
    </Modal>
  );
}

export default function HomeOverview() {
  const { vehicles, statuses, isLoadingVehicles } = useFleetData();
  const { pendingAlerts, sentAlerts } = useAlerts();
  const { status: connectionStatus } = useGlobalConnection();
  const [walkOpen, setWalkOpen] = useState(false);
  const [archOpen, setArchOpen] = useState(false);

  const onlineCount = vehicles.filter(
    (vehicle) => statuses[vehicle.vin],
  ).length;

  return (
    <div className="space-y-12">
      <section className="grid items-center gap-10 rounded-2xl bg-gradient-to-br from-[#0c1c2c] via-[#0a2540] to-[#0c1c2c] px-8 py-12 text-white shadow-xl md:grid-cols-2">
        <div className="space-y-6">
          <Badge variant="green">Live demo</Badge>
          <H1 className="!text-white">Connected Trucks</H1>
          <Body className="!text-base !text-gray-200">
            A guided tour of how the VISS standard, MQTT, and MongoDB work
            together to monitor a small fleet of trucks, detect tire incidents,
            and push warnings back to the driver in real time.
          </Body>

          <div className="flex flex-wrap items-center gap-3">
            <Link href="/fleet">
              <Button
                variant="primary"
                size="large"
                rightGlyph={<Icon glyph="ArrowRight" />}
              >
                Start demo
              </Button>
            </Link>
            <IconButton
              aria-label="Walk the demo"
              title="Walk the demo"
              darkMode
              onClick={() => setWalkOpen(true)}
            >
              <Icon glyph="QuestionMarkWithCircle" />
            </IconButton>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 text-gray-900 md:grid-cols-4">
            <MetricTile
              label="Vehicles"
              value={isLoadingVehicles ? "…" : vehicles.length || 0}
              hint={`${onlineCount} reporting`}
            />
            <MetricTile
              label="Pending alerts"
              value={pendingAlerts.length}
              hint="awaiting dispatch"
            />
            <MetricTile
              label="In-flight"
              value={sentAlerts.length}
              hint="sent to driver"
            />
            <MetricTile
              label="MQTT"
              value={
                connectionStatus === "connected" ? "Live" : connectionStatus
              }
              hint="global command bus"
            />
          </div>
        </div>

        <Card className="overflow-hidden bg-white p-3">
          <button
            type="button"
            onClick={() => setArchOpen(true)}
            className="group relative block w-full cursor-zoom-in overflow-hidden rounded-md"
            aria-label="Open architecture diagram in full view"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/architecture.svg"
              alt="Architecture diagram showing VISSR vehicles publishing telemetry over MQTT into MongoDB and being consumed by the demo app"
              className="block h-auto w-full"
              style={{ imageRendering: "auto" }}
            />
            <span className="pointer-events-none absolute right-2 top-2 flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-xs font-medium text-gray-700 opacity-0 shadow transition group-hover:opacity-100">
              <Icon glyph="OpenNewTab" size="small" />
              Expand
            </span>
          </button>
        </Card>
      </section>

      <section className="space-y-4">
        <div>
          <H2>Why this matters</H2>
          <Body className="text-gray-600">
            Four building blocks make this demo possible. Every page in the demo
            exercises one or more of them.
          </Body>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <Card key={feature.title} className="h-full p-5">
              <div className="flex items-center gap-2">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-md"
                  style={{ backgroundColor: palette.green.light3 }}
                >
                  <Icon glyph={feature.icon} fill={palette.green.dark2} />
                </span>
                <H3 className="!text-base">{feature.title}</H3>
              </div>
              <Body className="mt-2 text-sm text-gray-600">{feature.body}</Body>
            </Card>
          ))}
        </div>
      </section>

      <WalkDemoModal open={walkOpen} setOpen={setWalkOpen} />
      <ArchitectureModal open={archOpen} setOpen={setArchOpen} />
    </div>
  );
}
