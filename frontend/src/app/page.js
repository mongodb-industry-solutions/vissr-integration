import HomePageClient from "@/components/HomePage/HomePageClient";
import { persistWebSocketMessageAction } from "@/app/actions/vissWebSocket";

export const dynamic = "force-dynamic";

const DEFAULT_VSS_JSON_PATH = "/data/zod_vss.json";

export default function Home() {
  const defaultVssJsonPath = process.env.VSS_JSON_PATH || DEFAULT_VSS_JSON_PATH;

  return (
    <HomePageClient
      defaultVssJsonPath={defaultVssJsonPath}
      persistWebSocketMessageAction={persistWebSocketMessageAction}
    />
  );
}
