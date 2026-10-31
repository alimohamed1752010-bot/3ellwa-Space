import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError } from "../shared/api";
import { Button, Card, Input } from "../shared/ui";

function fmt(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function Login({ onAuthed }: { onAuthed: () => void }) {
  const [step, setStep] = useState<"password" | "code">("password");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [trust, setTrust] = useState(false);
  const [challengeId, setChallengeId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockLeft, setLockLeft] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (lockLeft <= 0) return;
    const t = window.setInterval(() => setLockLeft((n) => Math.max(0, n - 1)), 1000);
    return () => window.clearInterval(t);
  }, [lockLeft > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  function fail(e: unknown) {
    if (e instanceof ApiError) {
      if (e.code === "locked" && e.retryAfterSeconds) setLockLeft(e.retryAfterSeconds);
      setError(e.message);
      return e;
    }
    setError("Something went wrong. Try again.");
    return null;
  }

  async function submitPassword(ev: FormEvent) {
    ev.preventDefault();
    if (busy || lockLeft > 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ challengeId: string }>("/api/auth/password", { password });
      if (!res.challengeId) throw new Error("The server did not create a login challenge.");
      setPassword("");
      setChallengeId(res.challengeId);
      setCode("");
      setStep("code");
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(ev: FormEvent) {
    ev.preventDefault();
    if (busy || lockLeft > 0 || code.length !== 8) return;
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/auth/code", { challengeId, code, trustDevice: trust });
      onAuthed();
    } catch (e) {
      const err = fail(e);
      if (err?.code === "code_expired" || (err?.code === "invalid_code" && err.triesLeft === 0)) {
        setStep("password"); // that code is dead, start over
      } else {
        setCode("");
      }
    } finally {
      setBusy(false);
    }
  }

  const locked = lockLeft > 0;

  return (
    <main className="grid min-h-screen place-items-center p-5">
      <Card className="rise w-full max-w-sm p-7">
        <div className="mb-6">
          <div aria-hidden className="size-8 rounded-full shadow-[0_0_24px_-4px_rgb(139_92_246/0.7)]" style={{ background: "radial-gradient(circle at 35% 30%, #c4b5fd, #6d28d9 70%)" }} />
          <h1 className="mt-4 text-lg font-medium">{step === "password" ? "Sign in" : "Enter your code"}</h1>
          <p className="mt-1 text-sm text-muted">
            {step === "password" ? "Private area." : "An 8-digit code was sent to your private Discord channel. It lasts 5 minutes."}
          </p>
        </div>

        {step === "password" ? (
          <form onSubmit={submitPassword} className="flex flex-col gap-4">
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
            />
            <Feedback error={error} lockLeft={lockLeft} />
            <Button type="submit" loading={busy} disabled={!password || locked}>
              Continue
            </Button>
          </form>
        ) : (
          <form onSubmit={submitCode} className="flex flex-col gap-4">
            <Input
              ref={codeRef}
              label="Login code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={8}
              placeholder="00000000"
              className="text-center font-mono text-lg tracking-[0.35em]"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
              disabled={busy}
            />
            <label className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={trust} onChange={(e) => setTrust(e.target.checked)} className="size-4 accent-[var(--color-accent)]" />
              Trust this device for 30 days
            </label>
            <Feedback error={error} lockLeft={lockLeft} />
            <Button type="submit" loading={busy} disabled={code.length !== 8 || locked}>
              Sign in
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setStep("password"); setError(null); }}>
              Start over
            </Button>
          </form>
        )}
      </Card>
    </main>
  );
}

function Feedback({ error, lockLeft }: { error: string | null; lockLeft: number }) {
  if (!error && lockLeft <= 0) return null;
  return (
    <p role="alert" className="rounded-control border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
      {error}
      {lockLeft > 0 && <span className="ml-1 font-mono">Retry in {fmt(lockLeft)}.</span>}
    </p>
  );
}
