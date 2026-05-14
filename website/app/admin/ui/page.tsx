import { requireAdmin } from "@/lib/auth";
import { listConfig } from "@/lib/data";
import Shell from "@/components/Shell";
import ConfigEditor from "../ConfigEditor";

export const dynamic = "force-dynamic";

export default async function UiPage() {
  const user = await requireAdmin();
  const rows = await listConfig("uiConfig");
  return (
    <Shell email={user.email}>
      <h1 className="text-2xl font-semibold mb-1">UI Config</h1>
      <p className="text-muted text-sm mb-6">
        Remote UI customization — free game list, featured games, banners, theme tokens.
      </p>
      <ConfigEditor table="uiConfig" rows={rows} />
    </Shell>
  );
}
