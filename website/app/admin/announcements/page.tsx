import { requireAdmin } from "@/lib/auth";
import { listAnnouncements } from "@/lib/data";
import Shell from "@/components/Shell";
import Editor from "./Editor";

export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
  const user = await requireAdmin();
  const rows = await listAnnouncements();
  return (
    <Shell email={user.email}>
      <h1 className="text-2xl font-semibold mb-6">Announcements</h1>
      <Editor rows={rows} />
    </Shell>
  );
}
