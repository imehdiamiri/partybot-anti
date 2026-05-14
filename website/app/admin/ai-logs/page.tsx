import { requireAdmin } from "@/lib/auth";
import { listAiLogs } from "@/lib/data";
import Shell from "@/components/Shell";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AiLogsPage() {
  const user = await requireAdmin();
  const rows = await listAiLogs(200);

  return (
    <Shell email={user.email}>
      <h1 className="text-2xl font-semibold mb-6">AI Usage Logs</h1>
      <div className="card">
        <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Day</th>
              <th>User</th>
              <th>Calls</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.uid}-${r.day}`}>
                <td className="text-muted text-xs">{r.day}</td>
                <td>
                  <Link className="text-accent" href={`/admin/users/${r.uid}`}>
                    {r.username || r.uid.slice(0, 8)}
                  </Link>
                </td>
                <td>{r.count}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="text-muted text-center py-6">
                  No AI activity
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </Shell>
  );
}
