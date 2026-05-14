"use client";
import { useState, useTransition } from "react";
import { actionSetConfig, actionDeleteConfig } from "@/lib/actions";
import type { ConfigRow } from "@/lib/data";

export default function ConfigEditor({
  table,
  rows,
}: {
  table: "appConfig" | "uiConfig";
  rows: ConfigRow[];
}) {
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [busy, startTransition] = useTransition();

  function save(key: string, rawValue: string, description?: string) {
    startTransition(async () => {
      try {
        const value = JSON.parse(rawValue);
        await actionSetConfig(table, key, value, description);
        setEditing((s) => {
          const n = { ...s };
          delete n[key];
          return n;
        });
      } catch (e: any) {
        alert("Invalid JSON or error: " + (e?.message ?? String(e)));
      }
    });
  }

  function remove(key: string) {
    if (!confirm(`Delete ${key}?`)) return;
    startTransition(async () => {
      await actionDeleteConfig(table, key);
    });
  }

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h3 className="font-semibold mb-3">Add new key</h3>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr_1fr_auto] gap-2">
          <input
            className="input"
            placeholder="key.dot.path"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
          />
          <input
            className="input font-mono"
            placeholder='JSON value, e.g. "hello" or 42 or {"a":1}'
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
          />
          <input
            className="input"
            placeholder="description (optional)"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
          />
          <button
            className="btn btn-primary"
            disabled={busy || !newKey}
            onClick={() => {
              save(newKey, newValue || "null", newDesc);
              setNewKey("");
              setNewValue("");
              setNewDesc("");
            }}
          >
            Save
          </button>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Key</th>
              <th>Value</th>
              <th>Description</th>
              <th>Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const val = editing[r.key] ?? JSON.stringify(r.value, null, 0);
              const dirty = editing[r.key] !== undefined;
              return (
                <tr key={r.key}>
                  <td className="font-mono">{r.key}</td>
                  <td>
                    <textarea
                      className="input font-mono text-xs"
                      rows={dirty ? 3 : 1}
                      value={val}
                      onChange={(e) =>
                        setEditing((s) => ({ ...s, [r.key]: e.target.value }))
                      }
                    />
                  </td>
                  <td className="text-muted text-xs">{r.description}</td>
                  <td className="text-muted text-xs">
                    {r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="space-x-2 whitespace-nowrap">
                    {dirty && (
                      <button
                        className="btn btn-primary"
                        disabled={busy}
                        onClick={() => save(r.key, editing[r.key], r.description)}
                      >
                        Save
                      </button>
                    )}
                    <button className="btn btn-danger" disabled={busy} onClick={() => remove(r.key)}>
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-muted py-6">
                  No entries
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
