import { requireAdmin } from "@/lib/auth";
import { analyticsSummary } from "@/lib/data";
import Shell from "@/components/Shell";

export const dynamic = "force-dynamic";

function Stat({ label, value, hint }: { label: string; value: any; hint?: string }) {
  return (
    <div className="card p-5">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="text-3xl font-semibold mt-2">{value ?? "—"}</div>
      {hint && <div className="text-xs text-muted mt-1">{hint}</div>}
    </div>
  );
}

export default async function Dashboard() {
  const user = await requireAdmin();
  const s = await analyticsSummary();

  return (
    <Shell email={user.email}>
      <h1 className="text-2xl font-semibold mb-6">Overview</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Total users" value={s.totalUsers} />
        <Stat label="New (24h)" value={s.newUsers24h} />
        <Stat label="New (7d)" value={s.newUsers7d} />
        <Stat label="New (30d)" value={s.newUsers30d} />
        <Stat label="DAU" value={s.dau} hint="last 24h" />
        <Stat label="WAU" value={s.wau} hint="last 7 days" />
        <Stat label="MAU" value={s.mau} hint="last 30 days" />
        <Stat label="Active subs" value={s.activeSubscriptions} />
        <Stat label="Stars circulating" value={s.totalStarsCirculating} />
        <Stat label="AI calls (24h)" value={s.aiCalls24h} />
        <Stat label="Invites completed" value={s.invitesCompleted} />
        <Stat label="Banned users" value={s.bannedUsers} />
      </div>
    </Shell>
  );
}
