/**
 * Group signal paths by their VSS root (first dot-separated segment).
 *
 * Order is preserved: the returned groups appear in the order their root
 * was first seen in the input list, and paths within each group keep their
 * original selection order.
 *
 * @param {string[]} signals - Fully qualified VSS paths (e.g. "Vehicle.Speed").
 * @returns {Array<{ root: string, paths: string[] }>}
 *   `paths` are root-stripped (e.g. "Speed") so they can be used as VISS
 *   `paths` filter values under a single root prefix.
 */
export function groupSignalsByRoot(signals) {
  if (!Array.isArray(signals) || signals.length === 0) return [];

  const groupsByRoot = new Map();

  for (const signal of signals) {
    if (typeof signal !== "string" || !signal) continue;

    const dotIndex = signal.indexOf(".");
    const root = dotIndex === -1 ? signal : signal.slice(0, dotIndex);
    const remainder = dotIndex === -1 ? "" : signal.slice(dotIndex + 1);

    if (!groupsByRoot.has(root)) {
      groupsByRoot.set(root, []);
    }
    groupsByRoot.get(root).push(remainder);
  }

  return Array.from(groupsByRoot, ([root, paths]) => ({ root, paths }));
}
