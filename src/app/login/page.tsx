"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { AuthShell, AuthInput } from "@/components/auth-shell";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (res?.error) {
      setError("Incorrect email or password");
      setLoading(false);
      return;
    }

    const next = params.get("from") || "/find";
    router.push(next);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit}>
      <AuthInput
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        placeholder="you@company.com"
        autoComplete="email"
      />
      <AuthInput
        label="Password"
        type="password"
        value={password}
        onChange={setPassword}
        placeholder="Your password"
        autoComplete="current-password"
      />

      {error && <p className="mb-3 text-sm text-error">{error}</p>}

      <button
        type="submit"
        disabled={loading || !email || !password}
        className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-text transition-colors hover:bg-accent-hover disabled:opacity-40"
        style={{ transitionDuration: "var(--duration-fast)" }}
      >
        {loading ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to Elevateo Posts"
      footer={
        <>
          New here?{" "}
          <Link href="/signup" className="font-medium text-accent hover:text-accent-hover">
            Create an account
          </Link>
        </>
      }
    >
      <Suspense fallback={<div className="h-48" />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
