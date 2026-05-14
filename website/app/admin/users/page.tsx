import { requireAdmin } from "@/lib/auth";
import { listUsers } from "@/lib/data";
import Shell from "@/components/Shell";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireAdmin();
  const { q = "" } = await searchParams;
  const users = await listUsers(q, 100);

  return (
    <Shell email={user.email}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h1 className="text-2xl font-semibold">Users</h1>
        <form className="flex gap-2 w-full sm:w-auto">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search username, email, id…"
            className="input sm:w-80"
          />
          <button className="btn btn-primary">Search</button>
        </form>
      </div>
      <div className="card">
        <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Stars</th>
              <th>Sub</th>
              <th>Status</th>
              <th>Joined</th>
              <th>Last seen</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <Link href={`/admin/users/${u.id}`} className="text-accent">
                    {u.username || "(no name)"} <span className="text-muted">{u.id.slice(0, 6)}</span>
                  </Link>
                </td>
                <td className="text-muted">{u.email ?? "—"}</td>
                <td>{u.starsBalance}</td>
                <td>
                  {u.isPremium ? (
                    <span className="badge badge-green">{u.isLifetime ? "lifetime" : "active"}</span>
                  ) : (
                    <span className="badge">free</span>
                  )}
                </td>
                <td>
                  {u.isBanned ? (
                    <span className="badge badge-red">banned</span>
                  ) : (
                    <span className="badge badge-blue">ok</span>
                  )}
                </td>
                <td className="text-muted">
                  {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                </td>
                <td className="text-muted">
                  {u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleDateString() : "—"}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-muted py-8">
                  No users found
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
