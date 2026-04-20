export function getBrand() {
  const profile = process.env.PROFILE === "truck" ? "truck" : "default";

  return {
    profile,
    title: profile === "truck" ? "Connected Trucks" : "Connected Vehicles",
  };
}
