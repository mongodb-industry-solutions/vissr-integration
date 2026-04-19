import SandboxPageClient from "@/components/Sandbox/SandboxPageClient";
import { persistWebSocketMessageAction } from "@/app/actions/vissWebSocket";

export const dynamic = "force-dynamic";

const DEFAULT_VSS_JSON_PATH = "/data/zod_vss.json";

export default function SandboxPage() {
  const defaultVssJsonPath = process.env.VSS_JSON_PATH || DEFAULT_VSS_JSON_PATH;

  return (
    <SandboxPageClient
      defaultVssJsonPath={defaultVssJsonPath}
      persistWebSocketMessageAction={persistWebSocketMessageAction}
    />
  );
}
