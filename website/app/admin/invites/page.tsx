import { requireAdmin } from "@/lib/auth";
import { listInvites } from "@/lib/data";
import Shell from "@/components/Shell";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function InvitesPage() {
  const user = await requireAdmin();
  const rows = await listInvites(200);

  return (
    <Shell email={user.email}>
      <h1 className="text-2xl font-semibold mb-6">Invites</h1>
      <div className="card">
        <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Invited user</th>
              <th>Inviter</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link className="text-accent" href={`/admin/users/${r.id}`}>
                    {r.username || r.id.slice(0, 8)}
                  </Link>
                </td>
                <td>
                  <Link className="text-accent" href={`/admin/users/${r.invitedBy}`}>
                    {r.inviterName}
                  </Link>
                </td>
                <td className="text-muted text-xs">
                  {r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="text-muted text-center py-6">
                  No invites yet
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
