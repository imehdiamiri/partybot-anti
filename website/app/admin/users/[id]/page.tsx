import { requireAdmin } from "@/lib/auth";
import { userDetail } from "@/lib/data";
import Shell from "@/components/Shell";
import UserActions from "./UserActions";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAdmin();
  const { id } = await params;
  const detail = await userDetail(id);
  if (!detail) notFound();
  const { profile, unlocks, recentTransactions, recentAi, inviteStats, ban } = detail;

  return (
    <Shell email={user.email}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold truncate">{profile.username || "(no name)"}</h1>
          <div className="text-muted text-sm break-all">
            {profile.email ?? "no email"} · {id}
          </div>
        </div>
        <div className="sm:ml-auto flex flex-wrap gap-2">
          {profile.isPremium ? (
            <span className="badge badge-green">
              {profile.isLifetime ? "lifetime" : "subscribed"}
            </span>
          ) : (
            <span className="badge">free</span>
          )}
          {ban ? (
            <span className="badge badge-red">banned</span>
          ) : (
            <span className="badge badge-blue">active</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card p-5">
          <div className="text-xs text-muted uppercase mb-1">Stars balance</div>
          <div className="text-3xl font-semibold">{profile.starsBalance}</div>
        </div>
        <div className="card p-5">
          <div className="text-xs text-muted uppercase mb-1">Invite code</div>
          <div className="text-xl font-mono">{inviteStats.inviteCode ?? "—"}</div>
          <div className="text-xs text-muted mt-1">
            Invited {inviteStats.invitedCount} users
          </div>
        </div>
        <div className="card p-5">
          <div className="text-xs text-muted uppercase mb-1">Unlocked games</div>
          <div className="text-xl font-semibold">{unlocks.length}</div>
        </div>
      </div>

      <UserActions
        userId={id}
        unlocks={unlocks}
        isSubscribed={profile.isPremium}
        isBanned={!!ban}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <div className="card p-5">
          <h3 className="font-semibold mb-3">Recent star transactions</h3>
          <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Δ</th>
                <th>Type</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {recentTransactions.map((t) => (
                <tr key={t.id}>
                  <td className="text-muted">{new Date(t.createdAt).toLocaleString()}</td>
                  <td className={t.amount >= 0 ? "text-green-400" : "text-red-400"}>
                    {t.amount > 0 ? "+" : ""}
                    {t.amount}
                  </td>
                  <td>
                    <span className="badge">{t.type}</span>
                  </td>
                  <td className="text-muted">{t.reason}</td>
                </tr>
              ))}
              {recentTransactions.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-muted text-center py-4">
                    No transactions
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
        <div className="card p-5">
          <h3 className="font-semibold mb-3">Recent AI usage</h3>
          <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Day</th>
                <th>Calls</th>
              </tr>
            </thead>
            <tbody>
              {recentAi.map((a) => (
                <tr key={a.day}>
                  <td className="text-muted">{a.day}</td>
                  <td>{a.count}</td>
                </tr>
              ))}
              {recentAi.length === 0 && (
                <tr>
                  <td colSpan={2} className="text-muted text-center py-4">
                    No AI activity
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </Shell>
  );
}
