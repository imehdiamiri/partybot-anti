"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { clientAuth } from "@/lib/firebase-client";

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(
    search.get("error") === "not_admin" ? "This account is not an admin." : null
  );
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const auth = clientAuth();
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await cred.user.getIdToken();
      const resp = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        await signOut(auth).catch(() => {});
        if (data?.error === "not_admin") setErr("This account is not an admin.");
        else setErr("Sign-in failed.");
        return;
      }
      router.push("/admin");
    } catch (e: any) {
      setErr(e?.message ?? "Sign-in failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-8 w-full max-w-sm space-y-4">
      <div>
        <div className="text-xl font-semibold">PartyBot Admin</div>
        <div className="text-sm text-muted mt-1">Sign in with your Firebase admin account</div>
      </div>
      <input
        className="input"
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        className="input"
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      {err && <div className="text-sm text-red-400">{err}</div>}
      <button className="btn btn-primary w-full justify-center" disabled={loading}>
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export default function Login() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Suspense fallback={<div className="text-muted">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
