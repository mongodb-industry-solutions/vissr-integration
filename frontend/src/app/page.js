import HomePageClient from "@/components/HomePage/HomePageClient";

export const dynamic = "force-dynamic";

const DEFAULT_VSS_JSON_PATH = "/data/zod_vss.json";

export default function Home() {
  const vssJsonPath = process.env.VSS_JSON_PATH || DEFAULT_VSS_JSON_PATH;

  return <HomePageClient vssJsonPath={vssJsonPath} />;
}
