import { requireAdmin } from "@/lib/auth";
import { listAuditLog } from "@/lib/data";
import Shell from "@/components/Shell";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const user = await requireAdmin();
  const rows = await listAuditLog(300);
  return (
    <Shell email={user.email}>
      <h1 className="text-2xl font-semibold mb-6">Audit Log</h1>
      <div className="card">
        <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Admin</th>
              <th>Action</th>
              <th>Target</th>
              <th>Payload</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="text-muted text-xs">
                  {new Date(r.createdAt).toLocaleString()}
                </td>
                <td>{r.adminEmail}</td>
                <td>
                  <span className="badge">{r.action}</span>
                </td>
                <td className="text-muted text-xs">
                  {r.targetType}/{r.targetId}
                </td>
                <td className="text-muted text-xs font-mono max-w-md truncate">
                  {r.payload ? JSON.stringify(r.payload) : "—"}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="text-muted text-center py-6">
                  No actions logged
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
