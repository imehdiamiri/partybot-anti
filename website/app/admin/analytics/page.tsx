import { requireAdmin } from "@/lib/auth";
import { analyticsSummary, signupTimeseries } from "@/lib/data";
import Shell from "@/components/Shell";
import Chart from "./Chart";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const user = await requireAdmin();
  const [series, summary] = await Promise.all([signupTimeseries(30), analyticsSummary()]);

  return (
    <Shell email={user.email}>
      <h1 className="text-2xl font-semibold mb-6">Analytics</h1>
      <div className="card p-5 mb-6">
        <h3 className="font-semibold mb-3">Signups (last 30 days)</h3>
        <Chart data={series} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Total users" value={summary.totalUsers} />
        <Kpi label="DAU" value={summary.dau} />
        <Kpi label="WAU" value={summary.wau} />
        <Kpi label="MAU" value={summary.mau} />
        <Kpi label="Active subs" value={summary.activeSubscriptions} />
        <Kpi label="Invites done" value={summary.invitesCompleted} />
        <Kpi label="AI calls 24h" value={summary.aiCalls24h} />
        <Kpi label="Stars circulating" value={summary.totalStarsCirculating} />
      </div>
    </Shell>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-5">
      <div className="text-xs text-muted uppercase">{label}</div>
      <div className="text-2xl font-semibold mt-2">{value ?? "—"}</div>
    </div>
  );
}
