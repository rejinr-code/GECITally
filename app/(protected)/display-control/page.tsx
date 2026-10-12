import { requireRole } from "@/lib/auth/require-role";
import { HallDisplayScreen } from "@/components/display/hall-display-screen";

export const dynamic = "force-dynamic";

export default async function DisplayControlPage() {
  const { supabase } = await requireRole(["admin", "supervisor"]);
  const { error: schemaError } = await supabase.from("posts").select("display_released, display_released_rounds").limit(1);

  return <HallDisplayScreen schemaNeedsDisplayReleased={Boolean(schemaError)} />;
}
