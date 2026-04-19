const SEVERITY = {
  WARNING: "warning",
  NOTIFICATION: "notification",
};

const INCIDENT_TYPES = {
  LOW_PRESSURE: {
    type: "low_pressure",
    severity: SEVERITY.WARNING,
    title: "Low tire pressure",
    suggest: ({ wheelLabel, value }) =>
      `${wheelLabel}: pressure dropped to ${value} kPa. Reduce speed and head to the nearest service stop.`,
  },
  HIGH_TEMP: {
    type: "high_temperature",
    severity: SEVERITY.WARNING,
    title: "High tire temperature",
    suggest: ({ wheelLabel, value }) =>
      `${wheelLabel}: tire running hot at ${value}°C. Pull over safely to inspect.`,
  },
  MAINTENANCE: {
    type: "maintenance",
    severity: SEVERITY.NOTIFICATION,
    title: "Scheduled maintenance",
    suggest: () =>
      "Scheduled maintenance window starts in 90 minutes. Plan your route accordingly.",
  },
};

let nextAlertId = 1;
function buildAlertId() {
  const id = nextAlertId;
  nextAlertId += 1;
  return `alert_${Date.now().toString(36)}_${id}`;
}

function pickWheel(wheels) {
  if (!Array.isArray(wheels) || wheels.length === 0) {
    return {
      wheelLabel: "Front-left tire",
      wheelPath: null,
    };
  }
  const wheel = wheels[Math.floor(Math.random() * wheels.length)];
  return {
    wheelLabel: wheel.label,
    wheelPath: wheel.pressurePath,
  };
}

export function createSeedAlerts(vehicles) {
  if (!Array.isArray(vehicles) || vehicles.length === 0) {
    return [];
  }

  const seed = [];
  vehicles.forEach((vehicle, index) => {
    const isFirst = index === 0;
    const definition = isFirst
      ? INCIDENT_TYPES.LOW_PRESSURE
      : INCIDENT_TYPES.HIGH_TEMP;
    const value = isFirst ? 612 : 78;

    seed.push({
      id: buildAlertId(),
      vin: vehicle.vin,
      vehicleLabel: vehicle.label || vehicle.vin,
      type: definition.type,
      severity: definition.severity,
      title: definition.title,
      wheelLabel: isFirst ? "Trailer axle 1, position 13" : "Drive axle 2, position 5",
      wheelPath: null,
      value,
      message: definition.suggest({
        wheelLabel: isFirst
          ? "Trailer axle 1, position 13"
          : "Drive axle 2, position 5",
        value,
      }),
      createdAt: new Date(Date.now() - (index + 1) * 60_000).toISOString(),
      detectedBy: "Cloud ML model",
      status: "pending",
    });
  });

  return seed;
}

export function createMockIncident({ vehicle, wheels = [] }) {
  if (!vehicle) {
    return null;
  }

  const choices = [
    INCIDENT_TYPES.LOW_PRESSURE,
    INCIDENT_TYPES.HIGH_TEMP,
    INCIDENT_TYPES.MAINTENANCE,
  ];
  const definition = choices[Math.floor(Math.random() * choices.length)];

  if (definition.type === "maintenance") {
    return {
      id: buildAlertId(),
      vin: vehicle.vin,
      vehicleLabel: vehicle.label || vehicle.vin,
      type: definition.type,
      severity: definition.severity,
      title: definition.title,
      wheelLabel: null,
      wheelPath: null,
      value: null,
      message: definition.suggest({}),
      createdAt: new Date().toISOString(),
      detectedBy: "Maintenance scheduler",
      status: "pending",
    };
  }

  const { wheelLabel, wheelPath } = pickWheel(wheels);
  const value =
    definition.type === "low_pressure"
      ? 580 + Math.floor(Math.random() * 60)
      : 76 + Math.floor(Math.random() * 12);

  return {
    id: buildAlertId(),
    vin: vehicle.vin,
    vehicleLabel: vehicle.label || vehicle.vin,
    type: definition.type,
    severity: definition.severity,
    title: definition.title,
    wheelLabel,
    wheelPath,
    value,
    message: definition.suggest({ wheelLabel, value }),
    createdAt: new Date().toISOString(),
    detectedBy: "Cloud ML model",
    status: "pending",
  };
}

export const ALERT_SEVERITY = SEVERITY;
