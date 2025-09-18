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
  {
    label: "Vehicle Longitude",
    value: "Vehicle.CurrentLocation.Longitude",
    description: "Current longitude coordinate of the vehicle",
  },
  {
    label: "Vehicle Latitude",
    value: "Vehicle.CurrentLocation.Latitude",
    description: "Current latitude coordinate of the vehicle",
  },
];

/**
 * Default selected signals for the interface
 */
export const DEFAULT_SELECTED_SIGNALS = ["Vehicle.Speed"];
