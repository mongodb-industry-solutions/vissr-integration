function isObject(value) {
  return value !== null && typeof value === "object";
}

function getNestedValue(source, path) {
  if (!source || !path) return undefined;
  const segments = path.split(".");
  let cursor = source;
  for (const segment of segments) {
    if (!isObject(cursor)) return undefined;
    cursor = cursor[segment];
  }
  return cursor;
}

function descend(node, currentPath, visit) {
  if (!isObject(node)) return;

  if (node.children && isObject(node.children)) {
    for (const [key, child] of Object.entries(node.children)) {
      const nextPath = currentPath ? `${currentPath}.${key}` : key;
      visit(nextPath, child);
      descend(child, nextPath, visit);
    }
    return;
  }

  if (!node.type) {
    for (const [key, child] of Object.entries(node)) {
      if (!isObject(child)) continue;
      const nextPath = currentPath ? `${currentPath}.${key}` : key;
      visit(nextPath, child);
      descend(child, nextPath, visit);
    }
  }
}

/**
 * Walks a parsed VSS JSON tree and returns one descriptor per wheel that
 * exposes a Tire branch. Each descriptor has the paths needed to read live
 * pressure / temperature values from a vehicle_status document.
 */
export function extractWheelPositions(vssTree) {
  if (!isObject(vssTree)) return [];

  const wheels = [];

  descend(vssTree, "", (path, node) => {
    if (!path.endsWith(".Tire")) return;
    if (!isObject(node)) return;
    if (node.type && node.type !== "branch") return;

    // path looks like: Vehicle.Chassis.Axle.Axle1.Wheel.Pos10.Tire
    const wheelPath = path.slice(0, -".Tire".length);
    const segments = wheelPath.split(".");
    const root = segments[0];
    const axleSegment = segments.find((segment) => segment.startsWith("Axle"));
    const positionSegment = segments[segments.length - 1];

    if (!axleSegment || !positionSegment) return;

    const axleNumber = Number.parseInt(axleSegment.replace("Axle", ""), 10);
    const positionNumber = Number.parseInt(
      positionSegment.replace("Pos", ""),
      10,
    );

    wheels.push({
      id: `${root}::${axleSegment}::${positionSegment}`,
      root,
      axleSegment,
      axleNumber: Number.isFinite(axleNumber) ? axleNumber : 0,
      positionSegment,
      positionNumber: Number.isFinite(positionNumber) ? positionNumber : 0,
      side: positionNumber <= 6 ? "left" : "right",
      wheelPath,
      pressurePath: `${path}.Pressure`,
      temperaturePath: `${path}.Temperature`,
      lowPressurePath: `${path}.IsPressureLow`,
      highTempPath: `${path}.IsTemperatureHigh`,
      label: `${root === "Trailer" ? "Trailer" : "Truck"} ${axleSegment} ${positionSegment}`,
    });
  });

  wheels.sort((a, b) => {
    if (a.root !== b.root) return a.root === "Trailer" ? 1 : -1;
    if (a.axleNumber !== b.axleNumber) return a.axleNumber - b.axleNumber;
    return a.positionNumber - b.positionNumber;
  });

  return wheels;
}

function buildWheel({
  root,
  axleNumber,
  positionNumber,
  side,
  pairIndex,
  isSteer = false,
  isDual = false,
}) {
  const axleSegment = `Axle${axleNumber}`;
  const positionSegment = `Pos${positionNumber}`;
  const wheelPath = `${root}.Chassis.Axle.${axleSegment}.Wheel.${positionSegment}`;
  const tirePath = `${wheelPath}.Tire`;
  const labelRoot = root === "Trailer" ? "Trailer" : "Truck";
  return {
    id: `${root}::${axleSegment}::${positionSegment}`,
    root,
    axleSegment,
    axleNumber,
    positionSegment,
    positionNumber,
    side,
    pairIndex,
    isSteer,
    isDual,
    wheelPath,
    pressurePath: `${tirePath}.Pressure`,
    temperaturePath: `${tirePath}.Temperature`,
    lowPressurePath: `${tirePath}.IsPressureLow`,
    highTempPath: `${tirePath}.IsTemperatureHigh`,
    label: `${labelRoot} ${axleSegment} ${positionSegment}`,
  };
}

/**
 * Returns the canonical 18-wheel demo layout that the Tire diagram renders.
 * Every truck in the demo has the same physical layout so the visualisation
 * stays consistent. Live values from `vehicle_status` are layered on top of
 * this layout where the simulator emits them.
 */
export function buildDemoWheelLayout() {
  const wheels = [];

  wheels.push(
    buildWheel({
      root: "Vehicle",
      axleNumber: 1,
      positionNumber: 1,
      side: "left",
      pairIndex: 0,
      isSteer: true,
    }),
    buildWheel({
      root: "Vehicle",
      axleNumber: 1,
      positionNumber: 2,
      side: "right",
      pairIndex: 0,
      isSteer: true,
    }),
  );

  for (let axleIndex = 2; axleIndex <= 3; axleIndex += 1) {
    const positionBase = axleIndex === 2 ? 3 : 7;
    wheels.push(
      buildWheel({
        root: "Vehicle",
        axleNumber: axleIndex,
        positionNumber: positionBase,
        side: "left",
        pairIndex: 0,
        isDual: true,
      }),
      buildWheel({
        root: "Vehicle",
        axleNumber: axleIndex,
        positionNumber: positionBase + 1,
        side: "left",
        pairIndex: 1,
        isDual: true,
      }),
      buildWheel({
        root: "Vehicle",
        axleNumber: axleIndex,
        positionNumber: positionBase + 2,
        side: "right",
        pairIndex: 1,
        isDual: true,
      }),
      buildWheel({
        root: "Vehicle",
        axleNumber: axleIndex,
        positionNumber: positionBase + 3,
        side: "right",
        pairIndex: 0,
        isDual: true,
      }),
    );
  }

  for (let trailerAxleIndex = 1; trailerAxleIndex <= 2; trailerAxleIndex += 1) {
    const positionBase = trailerAxleIndex === 1 ? 11 : 15;
    wheels.push(
      buildWheel({
        root: "Trailer",
        axleNumber: trailerAxleIndex,
        positionNumber: positionBase,
        side: "left",
        pairIndex: 0,
      }),
      buildWheel({
        root: "Trailer",
        axleNumber: trailerAxleIndex,
        positionNumber: positionBase + 1,
        side: "left",
        pairIndex: 1,
        isDual: true,
      }),
      buildWheel({
        root: "Trailer",
        axleNumber: trailerAxleIndex,
        positionNumber: positionBase + 2,
        side: "right",
        pairIndex: 1,
        isDual: true,
      }),
      buildWheel({
        root: "Trailer",
        axleNumber: trailerAxleIndex,
        positionNumber: positionBase + 3,
        side: "right",
        pairIndex: 0,
      }),
    );
  }

  return wheels;
}

/**
 * Merges the canonical demo layout with whatever the loaded VSS schema
 * defines, so any explicit wheel (with its real VSS paths) overrides the
 * canonical metadata.
 */
export function mergeWithVssWheels(canonicalWheels, vssWheels) {
  if (!Array.isArray(vssWheels) || vssWheels.length === 0) {
    return canonicalWheels;
  }

  const byKey = new Map();
  vssWheels.forEach((wheel) => {
    byKey.set(`${wheel.root}::${wheel.axleSegment}::${wheel.positionSegment}`, wheel);
  });

  return canonicalWheels.map((canonical) => {
    const live = byKey.get(canonical.id);
    if (!live) return canonical;
    return {
      ...canonical,
      pressurePath: live.pressurePath,
      temperaturePath: live.temperaturePath,
      lowPressurePath: live.lowPressurePath,
      highTempPath: live.highTempPath,
    };
  });
}

/**
 * Reads the latest pressure and temperature for a wheel out of the live
 * vehicle_status document. Returns numeric values when present and `null`
 * otherwise so callers can decide whether to fall back to mock data.
 */
export function readWheelReading(vehicleStatus, wheel) {
  const pressure = getNestedValue(vehicleStatus, wheel.pressurePath);
  const temperature = getNestedValue(vehicleStatus, wheel.temperaturePath);
  const lowFlag = getNestedValue(vehicleStatus, wheel.lowPressurePath);
  const hotFlag = getNestedValue(vehicleStatus, wheel.highTempPath);

  return {
    pressure: typeof pressure === "number" ? pressure : null,
    temperature: typeof temperature === "number" ? temperature : null,
    isPressureLow: typeof lowFlag === "boolean" ? lowFlag : null,
    isTemperatureHigh: typeof hotFlag === "boolean" ? hotFlag : null,
  };
}
