function hashString(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pseudoRandom(seed) {
  // Mulberry32-ish lightweight PRNG used to keep mock values stable per wheel.
  let state = seed >>> 0;
  state = (state + 0x6d2b79f5) >>> 0;
  let temp = state;
  temp = Math.imul(temp ^ (temp >>> 15), temp | 1);
  temp ^= temp + Math.imul(temp ^ (temp >>> 7), temp | 61);
  return ((temp ^ (temp >>> 14)) >>> 0) / 4294967296;
}

function pickInRange(seed, min, max) {
  const random = pseudoRandom(seed);
  return min + random * (max - min);
}

function driftValue(baseValue, jitter, drifter) {
  const wave = Math.sin(drifter / 1000) * jitter;
  return baseValue + wave;
}

/**
 * Returns a synthetic but stable reading for a wheel so the dashboard can
 * always look complete even when the simulator feed only emits a subset of
 * the wheels in the VSS schema.
 */
export function buildMockReading({ vin, wheel, now = Date.now() }) {
  const seed = hashString(`${vin}:${wheel.id}`);
  const basePressure = pickInRange(seed, 760, 880);
  const baseTemp = pickInRange(seed + 99, 38, 55);
  const jitter = wheel.root === "Trailer" ? 6 : 9;

  const pressure = driftValue(basePressure, jitter, now + seed);
  const temperature = driftValue(baseTemp, 4, now + seed * 3);

  return {
    pressure: Math.round(pressure),
    temperature: Math.round(temperature * 10) / 10,
    isPressureLow: pressure < 700,
    isTemperatureHigh: temperature > 70,
    source: "mock",
  };
}

/**
 * Merges live readings (where available in the vehicle_status document) with
 * deterministic mock fallbacks for the remaining wheels.
 */
export function buildWheelReadings({ vin, wheels, vehicleStatus, now }) {
  return wheels.map((wheel) => {
    const live = readLiveReading(vehicleStatus, wheel);
    if (live.pressure !== null || live.temperature !== null) {
      const mock = buildMockReading({ vin, wheel, now });
      return {
        wheel,
        pressure: live.pressure ?? mock.pressure,
        temperature: live.temperature ?? mock.temperature,
        isPressureLow:
          live.isPressureLow ??
          (live.pressure !== null ? live.pressure < 700 : mock.isPressureLow),
        isTemperatureHigh:
          live.isTemperatureHigh ??
          (live.temperature !== null
            ? live.temperature > 70
            : mock.isTemperatureHigh),
        source: live.pressure !== null ? "live" : "mixed",
      };
    }

    const mock = buildMockReading({ vin, wheel, now });
    return {
      wheel,
      pressure: mock.pressure,
      temperature: mock.temperature,
      isPressureLow: mock.isPressureLow,
      isTemperatureHigh: mock.isTemperatureHigh,
      source: "mock",
    };
  });
}

function getNested(source, path) {
  if (!source || !path) return undefined;
  const segments = path.split(".");
  let cursor = source;
  for (const segment of segments) {
    if (!cursor || typeof cursor !== "object") return undefined;
    cursor = cursor[segment];
  }
  return cursor;
}

function readLiveReading(vehicleStatus, wheel) {
  const pressure = getNested(vehicleStatus, wheel.pressurePath);
  const temperature = getNested(vehicleStatus, wheel.temperaturePath);
  const lowFlag = getNested(vehicleStatus, wheel.lowPressurePath);
  const hotFlag = getNested(vehicleStatus, wheel.highTempPath);

  return {
    pressure: typeof pressure === "number" ? pressure : null,
    temperature: typeof temperature === "number" ? temperature : null,
    isPressureLow: typeof lowFlag === "boolean" ? lowFlag : null,
    isTemperatureHigh: typeof hotFlag === "boolean" ? hotFlag : null,
  };
}

export function tireStatus({ pressure, temperature, isPressureLow, isTemperatureHigh }) {
  if (
    isPressureLow === true ||
    isTemperatureHigh === true ||
    (typeof pressure === "number" && pressure < 650) ||
    (typeof temperature === "number" && temperature > 80)
  ) {
    return "danger";
  }
  if (
    (typeof pressure === "number" && pressure < 720) ||
    (typeof temperature === "number" && temperature > 65)
  ) {
    return "warning";
  }
  return "ok";
}
