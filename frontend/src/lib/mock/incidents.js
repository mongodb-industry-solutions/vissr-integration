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
  HIGH_BRAKE_TEMP: {
    type: "high_brake_temperature",
    severity: SEVERITY.WARNING,
    title: "High brake temperature",
    suggest: ({ wheelLabel, value }) =>
      `${wheelLabel}: brake running hot at ${value}°C. Reduce braking and let the assembly cool down.`,
  },
  MAINTENANCE: {
    type: "maintenance",
    severity: SEVERITY.NOTIFICATION,
    title: "Scheduled maintenance",
    suggest: () =>
      "Scheduled maintenance window starts in 90 minutes. Plan your route accordingly.",
  },
};

export const LIVE_FAULT_TYPES = {
  LOW_PRESSURE: INCIDENT_TYPES.LOW_PRESSURE.type,
  HIGH_TEMPERATURE: INCIDENT_TYPES.HIGH_TEMP.type,
  HIGH_BRAKE_TEMPERATURE: INCIDENT_TYPES.HIGH_BRAKE_TEMP.type,
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

function findDefinitionByType(faultType) {
  for (const definition of Object.values(INCIDENT_TYPES)) {
    if (definition.type === faultType) return definition;
  }
  return null;
}

function pathForFaultType(wheel, faultType) {
  if (!wheel) return null;
  if (faultType === LIVE_FAULT_TYPES.LOW_PRESSURE) return wheel.pressurePath || null;
  if (faultType === LIVE_FAULT_TYPES.HIGH_TEMPERATURE)
    return wheel.temperaturePath || null;
  if (faultType === LIVE_FAULT_TYPES.HIGH_BRAKE_TEMPERATURE)
    return wheel.brakeTemperaturePath || null;
  return null;
}

function formatFaultValue(faultType, value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (faultType === LIVE_FAULT_TYPES.LOW_PRESSURE) return Math.round(value);
  if (faultType === LIVE_FAULT_TYPES.HIGH_BRAKE_TEMPERATURE)
    return Math.round(value);
  return Number.parseFloat(value.toFixed(1));
}

/**
 * Builds an alert with the same shape as `createMockIncident` from a live
 * fault transition observed in `vehicle_status`. Used by the AlertsProvider
 * fault detector so the queue can show real sensor-driven faults alongside
 * the "Simulate" button's mock alerts.
 */
export function createLiveFaultAlert({ vehicle, wheel, type, value }) {
  if (!vehicle || !wheel || !type) return null;
  const definition = findDefinitionByType(type);
  if (!definition) return null;

  const wheelLabel = wheel.label || `${wheel.axleSegment} ${wheel.positionSegment}`;
  const formattedValue = formatFaultValue(type, value);
  const wheelPath = pathForFaultType(wheel, type);

  return {
    id: buildAlertId(),
    vin: vehicle.vin,
    vehicleLabel: vehicle.label || vehicle.vin,
    type: definition.type,
    severity: definition.severity,
    title: definition.title,
    wheelId: wheel.id || null,
    wheelLabel,
    wheelPath,
    value: formattedValue,
    message: definition.suggest({ wheelLabel, value: formattedValue ?? "?" }),
    createdAt: new Date().toISOString(),
    detectedBy: "Vehicle sensor",
    status: "pending",
  };
}

export const ALERT_SEVERITY = SEVERITY;
