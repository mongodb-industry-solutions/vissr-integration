"use client";

import { palette } from "@leafygreen-ui/palette";

const MAX_SPEED = 160;
const SIZE = 280;
const RADIUS = 110;
const CENTER = SIZE / 2;

function angleForSpeed(speed) {
  const clamped = Math.max(0, Math.min(MAX_SPEED, speed || 0));
  const ratio = clamped / MAX_SPEED;
  return -135 + ratio * 270;
}

function arcPath(startAngle, endAngle, radius) {
  const startRad = (Math.PI / 180) * startAngle;
  const endRad = (Math.PI / 180) * endAngle;
  const startX = CENTER + radius * Math.cos(startRad);
  const startY = CENTER + radius * Math.sin(startRad);
  const endX = CENTER + radius * Math.cos(endRad);
  const endY = CENTER + radius * Math.sin(endRad);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY}`;
}

function ticks() {
  const elements = [];
  for (let speed = 0; speed <= MAX_SPEED; speed += 20) {
    const angle = angleForSpeed(speed);
    const rad = (Math.PI / 180) * angle;
    const inner = RADIUS - 10;
    const outer = RADIUS + 4;
    const x1 = CENTER + inner * Math.cos(rad);
    const y1 = CENTER + inner * Math.sin(rad);
    const x2 = CENTER + outer * Math.cos(rad);
    const y2 = CENTER + outer * Math.sin(rad);
    const labelX = CENTER + (RADIUS - 26) * Math.cos(rad);
    const labelY = CENTER + (RADIUS - 26) * Math.sin(rad);
    elements.push(
      <g key={speed}>
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={palette.gray.dark1}
          strokeWidth={2}
        />
        <text
          x={labelX}
          y={labelY}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={palette.gray.dark2}
          fontSize={11}
          fontWeight={600}
        >
          {speed}
        </text>
      </g>,
    );
  }
  return elements;
}

export default function SpeedometerGauge({ speed = 0, label = "km/h" }) {
  const angle = angleForSpeed(speed);
  const needleRad = (Math.PI / 180) * angle;
  const needleX = CENTER + (RADIUS - 18) * Math.cos(needleRad);
  const needleY = CENTER + (RADIUS - 18) * Math.sin(needleRad);

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width="100%"
      height="auto"
      style={{ maxWidth: 320 }}
    >
      <defs>
        <linearGradient id="speedometer-arc" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor={palette.green.base} />
          <stop offset="60%" stopColor={palette.yellow.base} />
          <stop offset="100%" stopColor={palette.red.base} />
        </linearGradient>
      </defs>
      <circle
        cx={CENTER}
        cy={CENTER}
        r={RADIUS + 16}
        fill="#0a2540"
      />
      <circle
        cx={CENTER}
        cy={CENTER}
        r={RADIUS + 6}
        fill="#0c1c2c"
        stroke={palette.gray.dark2}
        strokeWidth={2}
      />
      <path
        d={arcPath(-135, 135, RADIUS)}
        stroke={palette.gray.dark2}
        strokeWidth={10}
        fill="none"
        strokeLinecap="round"
      />
      <path
        d={arcPath(-135, angle, RADIUS)}
        stroke="url(#speedometer-arc)"
        strokeWidth={10}
        fill="none"
        strokeLinecap="round"
      />
      {ticks()}
      <line
        x1={CENTER}
        y1={CENTER}
        x2={needleX}
        y2={needleY}
        stroke={palette.red.light2}
        strokeWidth={3.5}
        strokeLinecap="round"
      />
      <circle cx={CENTER} cy={CENTER} r={8} fill={palette.gray.light3} />
      <text
        x={CENTER}
        y={CENTER + 50}
        textAnchor="middle"
        fontSize={42}
        fontWeight={700}
        fill={palette.gray.light3}
      >
        {Math.round(speed || 0)}
      </text>
      <text
        x={CENTER}
        y={CENTER + 72}
        textAnchor="middle"
        fontSize={12}
        fill={palette.gray.light1}
      >
        {label}
      </text>
    </svg>
  );
}
