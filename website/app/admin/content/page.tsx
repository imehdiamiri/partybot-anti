import { requireAdmin } from "@/lib/auth";
import { listConfig } from "@/lib/data";
import Shell from "@/components/Shell";
import ConfigEditor from "../ConfigEditor";

export const dynamic = "force-dynamic";

export default async function ContentPage() {
  const user = await requireAdmin();
  const rows = await listConfig("appConfig");
  return (
    <Shell email={user.email}>
      <h1 className="text-2xl font-semibold mb-1">App Config</h1>
      <p className="text-muted text-sm mb-6">
        Remote configuration read by the mobile app. Edit JSON values carefully.
      </p>
      <ConfigEditor table="appConfig" rows={rows} />
    </Shell>
  );
}
