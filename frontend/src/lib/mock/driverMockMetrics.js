function hashString(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pseudoRandom(seed) {
  let state = (seed + 0x6d2b79f5) >>> 0;
  let temp = state;
  temp = Math.imul(temp ^ (temp >>> 15), temp | 1);
  temp ^= temp + Math.imul(temp ^ (temp >>> 7), temp | 61);
  return ((temp ^ (temp >>> 14)) >>> 0) / 4294967296;
}

function pickInRange(seed, min, max) {
  return min + pseudoRandom(seed) * (max - min);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Builds the mock fuel / range / RPM / odometer numbers shown on the driver
 * infotainment cluster. They drift slowly with time so the cluster looks
 * alive without depending on simulator data we don't have.
 */
export function buildDriverDashboardMetrics({
  vin,
  vehicleStatus,
  now = Date.now(),
}) {
  const seed = hashString(vin || "demo");
  const speed =
    typeof vehicleStatus?.Vehicle?.Speed === "number"
      ? vehicleStatus.Vehicle.Speed
      : 0;

  const baseFuel = pickInRange(seed, 55, 82);
  const fuelDrift = Math.sin(now / 60000 + seed) * 1.5;
  const fuelLevel = clamp(baseFuel + fuelDrift, 0, 100);

  const baseOdometer = Math.floor(pickInRange(seed + 1, 184_000, 312_000));
  const odometer = baseOdometer + Math.floor((now / 1000 / 60) % 50);

  const baseRpm = pickInRange(seed + 2, 950, 1450);
  const rpm = clamp(baseRpm + speed * 18 + Math.sin(now / 3000) * 60, 700, 2400);

  const range = Math.round((fuelLevel / 100) * pickInRange(seed + 3, 540, 720));
  const coolantTemp = clamp(
    pickInRange(seed + 4, 78, 92) + Math.sin(now / 8000) * 2,
    60,
    110,
  );
  const oilPressure = clamp(
    pickInRange(seed + 5, 320, 420) + Math.sin(now / 5000) * 12,
    150,
    520,
  );

  return {
    speed,
    fuelLevel: Math.round(fuelLevel),
    odometer,
    rpm: Math.round(rpm),
    range,
    coolantTemp: Math.round(coolantTemp),
    oilPressure: Math.round(oilPressure),
  };
}
