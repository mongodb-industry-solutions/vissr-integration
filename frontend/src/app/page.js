import HomePageClient from "@/components/HomePage/HomePageClient";

export const dynamic = "force-dynamic";

const DEFAULT_VSS_JSON_PATH = "/data/zod_vss.json";
const DEFAULT_MQTT_VIN = "MDBAX9C12XYZ1234";

export default function Home() {
  const vssJsonPath = process.env.VSS_JSON_PATH || DEFAULT_VSS_JSON_PATH;
  const mqttVin = process.env.MQTT_VIN || DEFAULT_MQTT_VIN;

  return <HomePageClient vssJsonPath={vssJsonPath} mqttVin={mqttVin} />;
}
