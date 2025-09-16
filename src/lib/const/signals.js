/**
 * VISS Signal Constants
 *
 * Common vehicle signals for the VISS WebSocket client.
 * Each signal includes a human-readable label and the corresponding VISS path.
 */

export const VISS_SIGNALS = [
  {
    label: "Vehicle Speed",
    value: "Vehicle.Speed",
    description: "Current speed of the vehicle",
  },
  {
    label: "Vehicle Traveled Distance",
    value: "Vehicle.TraveledDistance",
    description: "Total distance traveled by the vehicle",
  },
];

/**
 * Default selected signals for the interface
 */
export const DEFAULT_SELECTED_SIGNALS = ["Vehicle.Speed"];
