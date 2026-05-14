import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { listReports, type ReportRow } from "@/lib/data";
import { actionSetReportStatus } from "@/lib/actions";
import Shell from "@/components/Shell";

/**
 * Admin moderation queue. Lists raw user reports with the reporter, target,
 * reason, optional context and status. Enables a basic Pending/Reviewed
 * triage flow via server actions.
 */
export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; status?: string }>;
}) {
  const user = await requireAdmin();
  const sp = await searchParams;
  const reports = await listReports({ reason: sp.reason, status: sp.status, limit: 200 });

  const reasons = ["all", "harassment", "hate_speech", "sexual_content", "spam", "cheating", "underage", "other"];
  const statuses = ["all", "pending", "reviewed"];

  function chipHref(base: { reason?: string; status?: string }) {
    const params = new URLSearchParams();
    if (base.reason && base.reason !== "all") params.set("reason", base.reason);
    if (base.status && base.status !== "all") params.set("status", base.status);
    return `/admin/reports${params.toString() ? `?${params}` : ""}`;
  }

  return (
    <Shell email={user.email}>
      <h1 className="text-2xl font-semibold mb-4">Reports</h1>

      <div className="space-y-3 mb-4">
        <div className="flex flex-wrap gap-2 text-sm items-center">
          <span className="text-muted shrink-0">Reason:</span>
          {reasons.map((r) => {
            const active = (sp.reason ?? "all") === r;
            return (
              <Link
                key={r}
                href={chipHref({ reason: r, status: sp.status })}
                className={`px-2.5 py-1 rounded-full border text-xs ${
                  active
                    ? "bg-accent border-accent text-white"
                    : "bg-[#1a1a1d] border-[#28282c] text-muted hover:text-white"
                }`}
              >
                {r}
              </Link>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2 text-sm items-center">
          <span className="text-muted shrink-0">Status:</span>
          {statuses.map((s) => {
            const active = (sp.status ?? "all") === s;
            return (
              <Link
                key={s}
                href={chipHref({ reason: sp.reason, status: s })}
                className={`px-2.5 py-1 rounded-full border text-xs ${
                  active
                    ? "bg-accent border-accent text-white"
                    : "bg-[#1a1a1d] border-[#28282c] text-muted hover:text-white"
                }`}
              >
                {s}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Reporter</th>
                <th>Target</th>
                <th>Reason</th>
                <th>Context</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-8">
                    No reports found.
                  </td>
                </tr>
              ) : (
                reports.map((r: ReportRow) => (
                  <tr key={r.id}>
                    <td className="text-muted text-xs whitespace-nowrap">
                      {new Date(r.at).toLocaleString()}
                    </td>
                    <td className="font-mono text-xs">
                      <Link href={`/admin/users/${r.reporterUid}`} className="text-accent">
                        {r.reporterUid.slice(0, 10)}…
                      </Link>
                    </td>
                    <td className="font-mono text-xs">
                      <Link href={`/admin/users/${r.targetUid}`} className="text-accent">
                        {r.targetUid.slice(0, 10)}…
                      </Link>
                    </td>
                    <td>
                      <span className="badge">{r.reason}</span>
                    </td>
                    <td className="text-muted text-xs max-w-[280px] truncate" title={r.context}>
                      {r.context || "—"}
                    </td>
                    <td>
                      <form
                        action={async () => {
                          "use server";
                          await actionSetReportStatus(
                            r.id,
                            r.status === "reviewed" ? "pending" : "reviewed"
                          );
                        }}
                      >
                        <button
                          type="submit"
                          className={`badge ${
                            r.status === "reviewed" ? "badge-green" : "badge-yellow"
                          }`}
                          title={
                            r.status === "reviewed" ? "Mark as pending" : "Mark as reviewed"
                          }
                        >
                          {r.status}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-muted mt-3">
        Showing {reports.length} report(s). Reports are deduplicated server-side by
        (reporter, target, day) so a single user cannot flood the queue against the
        same target.
      </p>
    </Shell>
  );
}
