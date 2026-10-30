import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminApp from "./AdminApp";
import Login from "./Login";

type Reply = { status?: number; body: unknown };
let routes: Record<string, Reply[] | Reply>;
const calls: Array<{ path: string; method: string; body: any }> = [];

beforeEach(() => {
  calls.length = 0;
  routes = {};
  vi.stubGlobal("fetch", vi.fn(async (path: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    calls.push({ path, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const entry = routes[`${method} ${path}`];
    const r = Array.isArray(entry) ? entry.shift() : entry;
    if (!r) return new Response(JSON.stringify({ error: { code: "unmocked", message: "unmocked " + path } }), { status: 500 });
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200 });
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("Login", () => {
  it("password then code, sends trustDevice, then calls onAuthed", async () => {
    routes["POST /api/auth/password"] = { body: { challengeId: "c1", expiresInSeconds: 300 } };
    routes["POST /api/auth/code"] = { body: { authenticated: true } };
    const onAuthed = vi.fn();
    const u = userEvent.setup();
    render(<Login onAuthed={onAuthed} />);
    await u.type(screen.getByLabelText("Password"), "hunter2 hunter2");
    await u.click(screen.getByRole("button", { name: "Continue" }));
    const code = await screen.findByLabelText("Login code");
    await u.type(code, "1234abc5678"); // non-digits are stripped, capped at 8
    expect(code).toHaveValue("12345678");
    await u.click(screen.getByLabelText(/Trust this device/));
    await u.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(onAuthed).toHaveBeenCalled());
    expect(calls.find((c) => c.path === "/api/auth/code")!.body).toEqual({ challengeId: "c1", code: "12345678", trustDevice: true });
  });

  it("DISABLE_OTP response skips the code step", async () => {
    routes["POST /api/auth/password"] = { body: { authenticated: true } };
    const onAuthed = vi.fn();
    const u = userEvent.setup();
    render(<Login onAuthed={onAuthed} />);
    await u.type(screen.getByLabelText("Password"), "x");
    await u.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(onAuthed).toHaveBeenCalled());
    expect(screen.queryByLabelText("Login code")).toBeNull();
  });

  it("wrong password shows the error and stays on the password step", async () => {
    routes["POST /api/auth/password"] = { status: 401, body: { error: { code: "invalid_credentials", message: "Invalid password." } } };
    const u = userEvent.setup();
    render(<Login onAuthed={() => {}} />);
    await u.type(screen.getByLabelText("Password"), "nope");
    await u.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid password.");
    expect(screen.getByLabelText("Password")).toHaveValue("nope"); // kept so a typo is easy to fix
  });

  it("lockout shows a countdown and disables submit", async () => {
    routes["POST /api/auth/password"] = { status: 429, body: { error: { code: "locked", message: "Too many failed attempts. Try again later.", retryAfterSeconds: 125 } } };
    const u = userEvent.setup();
    render(<Login onAuthed={() => {}} />);
    await u.type(screen.getByLabelText("Password"), "nope");
    await u.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Retry in 2:05");
    await u.type(screen.getByLabelText("Password"), "again");
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("an expired code sends the user back to the password step", async () => {
    routes["POST /api/auth/password"] = { body: { challengeId: "c1" } };
    routes["POST /api/auth/code"] = { status: 401, body: { error: { code: "code_expired", message: "This code is no longer valid. Start again with your password." } } };
    const u = userEvent.setup();
    render(<Login onAuthed={() => {}} />);
    await u.type(screen.getByLabelText("Password"), "x");
    await u.click(screen.getByRole("button", { name: "Continue" }));
    await u.type(await screen.findByLabelText("Login code"), "11111111");
    await u.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("no longer valid");
  });

  it("Discord failure message is shown", async () => {
    routes["POST /api/auth/password"] = { status: 502, body: { error: { code: "discord_unavailable", message: "Could not send the code to Discord." } } };
    const u = userEvent.setup();
    render(<Login onAuthed={() => {}} />);
    await u.type(screen.getByLabelText("Password"), "x");
    await u.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Discord");
  });
});

describe("AdminApp", () => {
  it("anonymous visitor sees the login, not the dashboard", async () => {
    routes["GET /api/auth/me"] = { body: { authenticated: false } };
    render(<AdminApp basename="/" />);
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Admin" })).toBeNull();
  });

  it("signed-in session shows all 14 nav items, and logout returns to login", async () => {
    routes["GET /api/auth/me"] = { body: { authenticated: true } };
    routes["POST /api/auth/logout"] = { body: { ok: true } };
    const u = userEvent.setup();
    render(<AdminApp basename="/" />);
    const navs = await screen.findAllByRole("navigation", { name: "Admin" });
    expect(navs[0].querySelectorAll("a")).toHaveLength(14);
    expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument();
    await u.click(screen.getAllByRole("link", { name: "Pages" })[0]);
    expect(await screen.findByRole("heading", { name: "Pages" })).toBeInTheDocument();
    expect(screen.getByText(/built in Part 4/)).toBeInTheDocument();
    await u.click(screen.getAllByRole("button", { name: "Log out" })[0]);
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    await act(async () => {});
  });
});
