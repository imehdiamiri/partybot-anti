"use client";
import { useState, useTransition } from "react";
import { actionCreateAnnouncement, actionToggleAnnouncement } from "@/lib/actions";
import type { Announcement } from "@/lib/data";

export default function Editor({ rows }: { rows: Announcement[] }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<"all" | "free" | "subscribed">("all");
  const [sendPush, setSendPush] = useState(false);
  const [busy, startTransition] = useTransition();

  function create() {
    if (!title || !body) return;
    startTransition(async () => {
      try {
        await actionCreateAnnouncement({ title, body, audience, sendPush, active: true });
        setTitle("");
        setBody("");
      } catch (e: any) {
        alert(e?.message ?? String(e));
      }
    });
  }

  function toggle(id: string, active: boolean) {
    startTransition(async () => {
      await actionToggleAnnouncement(id, active);
    });
  }

  return (
    <div className="space-y-6">
      <div className="card p-5 space-y-3">
        <h3 className="font-semibold">New announcement</h3>
        <input
          className="input"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="input"
          rows={3}
          placeholder="Body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="flex flex-wrap gap-3 items-center">
          <select
            className="input w-40"
            value={audience}
            onChange={(e) => setAudience(e.target.value as "all" | "free" | "subscribed")}
          >
            <option value="all">All users</option>
            <option value="free">Free users</option>
            <option value="subscribed">Subscribers</option>
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={sendPush}
              onChange={(e) => setSendPush(e.target.checked)}
            />{" "}
            Send push
          </label>
          <button className="btn btn-primary ml-auto" disabled={busy} onClick={create}>
            Publish
          </button>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Audience</th>
              <th>Push</th>
              <th>Created</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <div className="font-semibold">{r.title}</div>
                  <div className="text-muted text-xs">{r.body}</div>
                </td>
                <td>
                  <span className="badge">{r.audience}</span>
                </td>
                <td>{r.sendPush ? "✓" : "—"}</td>
                <td className="text-muted text-xs">
                  {new Date(r.createdAt).toLocaleString()}
                </td>
                <td>
                  {r.active ? (
                    <span className="badge badge-green">active</span>
                  ) : (
                    <span className="badge">archived</span>
                  )}
                </td>
                <td>
                  <button className="btn" disabled={busy} onClick={() => toggle(r.id, !r.active)}>
                    {r.active ? "Archive" : "Unarchive"}
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-muted py-6">
                  None yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
