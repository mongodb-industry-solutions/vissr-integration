function isObject(value) {
  return value !== null && typeof value === "object";
}

/**
 * Returns a short, human-friendly side label. Steer and single-tire
 * trailer axles say just "Left"/"Right"; dual-tire axles use
 * "Left outer"/"Left inner"/"Right inner"/"Right outer" so the position
 * on the rig is unambiguous when scanning the per-wheel list.
 */
function describePosition(wheel) {
  const sideWord = wheel.side === "left" ? "Left" : "Right";
  if (wheel.isDual) {
    const innerOuter = wheel.pairIndex === 1 ? "outer" : "inner";
    return `${sideWord} ${innerOuter}`;
  }
  return sideWord;
}

/**
 * Adds friendly axle labels and roles to a freshly-built wheel list.
 * `axleRole` is "steer" | "drive" | "trailer". `axleLabel` is what we
 * surface to operators ("Steer", "Drive 1", "Trailer Axle 2"). Drive
 * and trailer axle indices are derived from the sorted axle numbers
 * inside each root, so renumbering (e.g. trailer Axle10/Axle12) doesn't
 * leak through to the UI.
 */
function annotateAxleLabels(wheels) {
  const axleNumbersByRoot = new Map();
  for (const wheel of wheels) {
    if (!axleNumbersByRoot.has(wheel.root)) {
      axleNumbersByRoot.set(wheel.root, new Set());
    }
    axleNumbersByRoot.get(wheel.root).add(wheel.axleNumber);
  }

  const orderedAxleNumbers = new Map();
  for (const [root, set] of axleNumbersByRoot.entries()) {
    orderedAxleNumbers.set(
      root,
      Array.from(set).sort((a, b) => a - b),
    );
  }

  for (const wheel of wheels) {
    const ordered = orderedAxleNumbers.get(wheel.root) || [];
    const axleIndex = ordered.indexOf(wheel.axleNumber);
    const axleOrder = axleIndex === -1 ? 0 : axleIndex;
    wheel.axleOrder = axleOrder;

    if (wheel.root === "Trailer") {
      wheel.axleRole = "trailer";
      wheel.axleLabel = `Trailer Axle ${axleOrder + 1}`;
    } else if (wheel.isSteer) {
      wheel.axleRole = "steer";
      wheel.axleLabel = "Steer";
    } else {
      wheel.axleRole = "drive";
      wheel.axleLabel = `Drive ${axleOrder}`;
    }
  }
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
 * pressure / temperature values from a vehicle_status document, plus the
 * left/right + dual / pair-index metadata that the tire diagram uses to
 * lay out the wheels visually.
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
    // Skip the parent "Axle" branch — we want the indexed segment like
    // "Axle1"/"Axle12". Without the regex anchor, find() would return the
    // bare "Axle" label and bucket every wheel into the same axle.
    const axleSegment = segments.find((segment) => /^Axle\d+$/.test(segment));
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
      // The first axle of the tractor is, by convention, the steer axle.
      isSteer: root !== "Trailer" && axleNumber === 1,
      // isDual / pairIndex are filled in below once we know how many
      // wheels share a side on each axle.
      isDual: false,
      pairIndex: 0,
      wheelPath,
      pressurePath: `${path}.Pressure`,
      temperaturePath: `${path}.Temperature`,
      lowPressurePath: `${path}.IsPressureLow`,
      highTempPath: `${path}.IsTemperatureHigh`,
      brakeTemperaturePath: `${wheelPath}.Brake.Temperature`,
      brakeHighTempPath: `${wheelPath}.Brake.IsTemperatureHigh`,
      label: `${root === "Trailer" ? "Trailer" : "Truck"} · ${axleSegment} · ${positionSegment}`,
    });
  });

  // For each (root, axle, side) group: if there are 2 wheels they are dual
  // tires (lower position number = pairIndex 0 / inner, higher = pairIndex
  // 1 / outer). The tire diagram uses these flags to offset the tires so
  // duals don't overlap visually.
  const sideGroups = new Map();
  for (const wheel of wheels) {
    const key = `${wheel.root}::${wheel.axleSegment}::${wheel.side}`;
    if (!sideGroups.has(key)) sideGroups.set(key, []);
    sideGroups.get(key).push(wheel);
  }
  for (const group of sideGroups.values()) {
    group.sort((a, b) => a.positionNumber - b.positionNumber);
    if (group.length >= 2) {
      group.forEach((wheel, index) => {
        wheel.isDual = true;
        wheel.pairIndex = index === 0 ? 0 : 1;
      });
    }
  }

  for (const wheel of wheels) {
    wheel.sideLabel = describePosition(wheel);
  }

  annotateAxleLabels(wheels);

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
  const brakePath = `${wheelPath}.Brake`;
  const labelRoot = root === "Trailer" ? "Trailer" : "Truck";
  const wheel = {
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
    brakeTemperaturePath: `${brakePath}.Temperature`,
    brakeHighTempPath: `${brakePath}.IsTemperatureHigh`,
    label: `${labelRoot} · ${axleSegment} · ${positionSegment}`,
  };
  wheel.sideLabel = describePosition(wheel);
  return wheel;
}

/** Convenience for callers that need the same labelling on a hand-built layout. */
export function annotateWheelLayout(wheels) {
  if (!Array.isArray(wheels)) return wheels;
  annotateAxleLabels(wheels);
  return wheels;
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

  annotateAxleLabels(wheels);

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
      brakeTemperaturePath: live.brakeTemperaturePath,
      brakeHighTempPath: live.brakeHighTempPath,
      sideLabel: canonical.sideLabel || live.sideLabel,
      axleRole: canonical.axleRole || live.axleRole,
      axleLabel: canonical.axleLabel || live.axleLabel,
      axleOrder: canonical.axleOrder ?? live.axleOrder,
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
  const brakeTemperature = wheel.brakeTemperaturePath
    ? getNestedValue(vehicleStatus, wheel.brakeTemperaturePath)
    : undefined;
  const brakeHotFlag = wheel.brakeHighTempPath
    ? getNestedValue(vehicleStatus, wheel.brakeHighTempPath)
    : undefined;

  return {
    pressure: typeof pressure === "number" ? pressure : null,
    temperature: typeof temperature === "number" ? temperature : null,
    isPressureLow: typeof lowFlag === "boolean" ? lowFlag : null,
    isTemperatureHigh: typeof hotFlag === "boolean" ? hotFlag : null,
    brakeTemperature:
      typeof brakeTemperature === "number" ? brakeTemperature : null,
    isBrakeTemperatureHigh:
      typeof brakeHotFlag === "boolean" ? brakeHotFlag : null,
  };
}
