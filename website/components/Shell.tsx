"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { actionSignOut } from "@/lib/actions";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: "📊" },
  { href: "/admin/users", label: "Users", icon: "👥" },
  { href: "/admin/reports", label: "Reports", icon: "🚩" },
  { href: "/admin/invites", label: "Invites", icon: "🎁" },
  { href: "/admin/ai-logs", label: "AI Logs", icon: "🤖" },
  { href: "/admin/analytics", label: "Analytics", icon: "📈" },
  { href: "/admin/content", label: "App Config", icon: "⚙️" },
  { href: "/admin/ui", label: "UI Config", icon: "🎨" },
  { href: "/admin/announcements", label: "Announcements", icon: "📣" },
  { href: "/admin/audit", label: "Audit Log", icon: "📜" },
];

export default function Shell({ email, children }: { email: string; children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => {
    setOpen(false);
  }, [path]);

  // Lock body scroll while drawer is open on mobile
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  const navList = (
    <nav className="flex flex-col gap-1">
      {NAV.map((n) => {
        const active = path === n.href || (n.href !== "/admin" && path.startsWith(n.href));
        return (
          <Link
            key={n.href}
            href={n.href}
            className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${
              active ? "bg-[#1a1a1d] text-white" : "text-muted hover:text-white hover:bg-[#141416]"
            }`}
          >
            <span>{n.icon}</span>
            {n.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-panel px-4 h-14">
        <button
          aria-label="Open menu"
          onClick={() => setOpen(true)}
          className="p-2 -ml-2 rounded-md hover:bg-[#1a1a1d]"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div className="text-base font-semibold">PartyBot Admin</div>
        <form action={actionSignOut}>
          <button type="submit" className="text-xs text-muted hover:text-white">
            Sign out
          </button>
        </form>
      </header>

      {/* Mobile drawer overlay */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar (desktop = static, mobile = slide-in drawer) */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-72 max-w-[85vw] lg:w-auto lg:max-w-none border-r border-border bg-panel p-4 flex flex-col transform transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <div className="flex items-center justify-between mb-6 px-2">
          <div className="text-lg font-semibold">PartyBot Admin</div>
          <button
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="lg:hidden p-1 rounded-md hover:bg-[#1a1a1d]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        {navList}
        <div className="mt-auto pt-4 border-t border-border text-xs text-muted">
          <div className="truncate mb-2">{email}</div>
          <form action={actionSignOut}>
            <button type="submit" className="btn w-full justify-center">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <main className="p-4 sm:p-6 overflow-x-hidden min-w-0">{children}</main>
    </div>
  );
}
