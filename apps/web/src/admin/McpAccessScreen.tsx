import { useState } from "react";
import { api, ApiError } from "../shared/api";
import { Button, Card, CardBody, useToast } from "../shared/ui";

type Pairing = { code: string; expiresInSeconds: number };

export default function McpAccessScreen() {
  const toast = useToast();
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function createPairing() {
    setBusy(true);
    setError("");
    setPairing(null);
    try {
      const result = await api.post<Pairing>("/api/auth/pairing", {});
      setPairing(result);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not create a pairing code.");
    } finally {
      setBusy(false);
    }
  }

  async function copyCode() {
    if (!pairing) return;
    try {
      await navigator.clipboard.writeText(pairing.code);
      toast.show("One-time code copied. It expires in two minutes.", "success");
    } catch {
      toast.show("Clipboard access was blocked. Select and copy the code manually.", "error");
    }
  }

  return (
    <div className="rise flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-medium">MCP Access</h1>
        <p className="mt-1 text-sm text-muted">Connect the Site Manager plugin without sharing your website password or Discord login code.</p>
      </div>
      <Card>
        <CardBody className="flex flex-col gap-3">
          <h2 className="font-medium">Create a one-time pairing code</h2>
          <p className="text-sm text-muted">First sign in here with your normal password and Discord OTP. Generate a code, then exchange it using the Site Manager plugin. The code works once and expires after two minutes.</p>
          <div>
            <Button onClick={() => void createPairing()} loading={busy}>Generate pairing code</Button>
          </div>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          {pairing && (
            <div className="rounded-control border border-line bg-raised p-3">
              <p className="text-xs text-muted">One-time pairing code</p>
              <code className="mt-2 block break-all text-sm text-ink">{pairing.code}</code>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => void copyCode()}>Copy code</Button>
                <span className="text-xs text-muted">Expires in {pairing.expiresInSeconds} seconds</span>
              </div>
            </div>
          )}
        </CardBody>
      </Card>
      <Card>
        <CardBody>
          <h2 className="font-medium">Security</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
            <li>Your password and Discord OTP stay on this website's normal login screen.</li>
            <li>The pairing code is single-use and stored only as a SHA-256 hash.</li>
            <li>The plugin receives a separate, normal 12-hour admin session. It cannot extend your browser session.</li>
            <li>Never paste the pairing code into a public channel or share it with anyone.</li>
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
