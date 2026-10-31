import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminApp from "./admin/AdminApp";
import NavigationScreen from "./admin/navigation/NavigationScreen";
import ProfileScreen from "./admin/profile/ProfileScreen";
import { checkImageFile } from "./admin/profile/types";
import PublicApp from "./public/PublicApp";
import TypingSubtitle from "./public/TypingSubtitle";
import { ToastProvider } from "./shared/ui";

type Reply = { status?: number; body: unknown };
let routes: Record<string, Reply[] | Reply>;
const calls: Array<{ path: string; method: string; body: any }> = [];

beforeEach(() => {
  calls.length = 0;
  routes = {};
  // jsdom has no <dialog> methods.
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); };
  vi.stubGlobal("fetch", vi.fn(async (path: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : init?.body ? "[form]" : undefined;
    calls.push({ path, method, body });
    const entry = routes[`${method} ${path}`];
    const r = Array.isArray(entry) ? entry.shift() : entry;
    if (!r) return new Response(JSON.stringify({ error: { code: "unmocked", message: "unmocked " + method + " " + path } }), { status: 500 });
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200 });
  }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

const baseProfile = {
  displayName: "Ada", username: "ada", shortBio: "Hi", extendedBio: "", subtitles: ["Builder", "Gamer"], typingEnabled: false,
  statusText: "", onlineMode: "hidden", locationText: "", showLocation: false, timezone: null, showLocalTime: false,
  avatarAssetId: null, bannerAssetId: null, avatarUrl: null, bannerUrl: null, badges: [], updatedAt: "x",
};
const wrap = (ui: React.ReactNode) => render(<ToastProvider>{ui}</ToastProvider>);

describe("Profile screen", () => {
  beforeEach(() => { routes["GET /api/admin/social-links"] = { body: { items: [] } }; });

  it("Save is disabled until something changes, then sends the full payload (subtitles from lines)", async () => {
    routes["GET /api/admin/profile"] = { body: { profile: baseProfile } };
    routes["PUT /api/admin/profile"] = { body: { profile: { ...baseProfile, displayName: "Ada L", subtitles: ["One", "Two", "Three"] } } };
    const u = userEvent.setup();
    wrap(<ProfileScreen />);
    const name = await screen.findByLabelText("Display name");
    expect(screen.getByRole("button", { name: "Save profile" })).toBeDisabled();
    expect(screen.getByText("All changes saved")).toBeInTheDocument();
    await u.type(name, " L");
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    const sub = screen.getByLabelText("Animated subtitle");
    await u.clear(sub);
    await u.type(sub, "One{Enter}Two{Enter}{Enter}Three");
    await u.click(screen.getByRole("button", { name: "Save profile" }));
    expect(await screen.findByText("Profile saved. It is live now.")).toBeInTheDocument();
    const put = calls.find((c) => c.method === "PUT")!.body;
    expect(put.displayName).toBe("Ada L");
    expect(put.subtitles).toEqual(["One", "Two", "Three"]); // blank line dropped
    expect("avatarUrl" in put).toBe(false);
    expect(put.timezone).toBeNull();
    expect(screen.getByText("All changes saved")).toBeInTheDocument();
  });

  it("shows the server's validation message and stays dirty", async () => {
    routes["GET /api/admin/profile"] = { body: { profile: baseProfile } };
    routes["PUT /api/admin/profile"] = { status: 400, body: { error: { code: "validation_failed", message: "timezone: unknown time zone" } } };
    const u = userEvent.setup();
    wrap(<ProfileScreen />);
    await u.type(await screen.findByLabelText("Time zone"), "Mars/Olympus");
    await u.click(screen.getByRole("button", { name: "Save profile" }));
    expect(await screen.findAllByText("timezone: unknown time zone")).not.toHaveLength(0);
    expect(screen.getByRole("button", { name: "Save profile" })).toBeEnabled();
  });

  it("load failure offers a retry", async () => {
    routes["GET /api/admin/profile"] = [{ status: 500, body: { error: { code: "x", message: "Boom" } } }, { body: { profile: baseProfile } }];
    const u = userEvent.setup();
    wrap(<ProfileScreen />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Boom");
    await u.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByLabelText("Display name")).toHaveValue("Ada");
  });

  it("adds and removes badges", async () => {
    routes["GET /api/admin/profile"] = { body: { profile: baseProfile } };
    const u = userEvent.setup();
    wrap(<ProfileScreen />);
    await u.type(await screen.findByLabelText("New badge"), "Verified{Enter}");
    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: "Remove badge Verified" }));
    expect(screen.queryByText("Verified")).toBeNull();
    expect(screen.getByText("All changes saved")).toBeInTheDocument();
  });

  it("rejects a wrong file type and an oversized file before uploading", async () => {
    routes["GET /api/admin/profile"] = { body: { profile: baseProfile } };
    const u = userEvent.setup({ applyAccept: false });
    wrap(<ProfileScreen />);
    await screen.findByLabelText("Display name");
    await u.upload(screen.getByLabelText("Avatar file"), new File(["x"], "a.svg", { type: "image/svg+xml" }));
    expect(await screen.findByText("Only PNG, JPEG, WebP, and GIF images are allowed.")).toBeInTheDocument();
    const big = new File([new Uint8Array(2 * 1048576 + 1)], "big.png", { type: "image/png" });
    await u.upload(screen.getByLabelText("Avatar file"), big);
    expect(await screen.findByText(/The avatar limit is 2 MB/)).toBeInTheDocument();
    expect(calls.some((c) => c.path.includes("upload"))).toBe(false);
  });

  it("uploads an avatar, previews it, and marks the profile unsaved", async () => {
    routes["GET /api/admin/profile"] = { body: { profile: baseProfile } };
    routes["POST /api/admin/media/upload"] = { status: 201, body: { asset: { id: "a1", filename: "me.png", mimeType: "image/png", sizeBytes: 5, url: "/media/a1/me.png" } } };
    const u = userEvent.setup();
    wrap(<ProfileScreen />);
    await screen.findByLabelText("Display name");
    await u.upload(screen.getByLabelText("Avatar file"), new File(["x"], "me.png", { type: "image/png" }));
    await waitFor(() => expect(document.querySelector('img[src="/media/a1/me.png"]')).not.toBeNull());
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
  });

  it("avatar and banner uploads that finish together both stick", async () => {
    routes["GET /api/admin/profile"] = { body: { profile: baseProfile } };
    routes["POST /api/admin/media/upload"] = [
      { status: 201, body: { asset: { id: "a1", filename: "a.png", mimeType: "image/png", sizeBytes: 1, url: "/media/a1/a.png" } } },
      { status: 201, body: { asset: { id: "b1", filename: "b.png", mimeType: "image/png", sizeBytes: 1, url: "/media/b1/b.png" } } },
    ];
    routes["PUT /api/admin/profile"] = { body: { profile: baseProfile } };
    const u = userEvent.setup();
    wrap(<ProfileScreen />);
    await screen.findByLabelText("Display name");
    // Fire both before either resolves.
    await Promise.all([
      u.upload(screen.getByLabelText("Avatar file"), new File(["x"], "a.png", { type: "image/png" })),
      u.upload(screen.getByLabelText("Banner file"), new File(["x"], "b.png", { type: "image/png" })),
    ]);
    await waitFor(() => expect(document.querySelectorAll('img[src^="/media/"]')).toHaveLength(2));
    await u.click(screen.getByRole("button", { name: "Save profile" }));
    await waitFor(() => expect(calls.some((c) => c.method === "PUT")).toBe(true));
    const put = calls.find((c) => c.method === "PUT")!.body;
    expect(put.avatarAssetId).toBeTruthy();
    expect(put.bannerAssetId).toBeTruthy();
  });

  it("checkImageFile boundaries", () => {
    expect(checkImageFile(new File([new Uint8Array(2 * 1048576)], "a.png", { type: "image/png" }), "avatar")).toBeNull();
    expect(checkImageFile(new File([new Uint8Array(2 * 1048576 + 1)], "a.png", { type: "image/png" }), "avatar")).toMatch(/limit/);
    expect(checkImageFile(new File([new Uint8Array(3 * 1048576)], "a.png", { type: "image/png" }), "banner")).toBeNull();
  });
});

describe("Social links", () => {
  it("adds a link and reorders (saved live)", async () => {
    routes["GET /api/admin/profile"] = { body: { profile: baseProfile } };
    const a = { id: "s1", platform: "github", label: null, url: "https://github.com/a", icon: null, visible: true };
    const b = { id: "s2", platform: "discord", label: "Disc", url: "https://discord.com/x", icon: null, visible: true };
    routes["GET /api/admin/social-links"] = { body: { items: [a] } };
    routes["POST /api/admin/social-links"] = { status: 201, body: { items: [a, b] } };
    routes["PUT /api/admin/social-links/order"] = { body: { items: [b, a] } };
    const u = userEvent.setup();
    wrap(<ProfileScreen />);
    await u.click(await screen.findByRole("button", { name: "Add link" }));
    const dialog = await screen.findByRole("dialog");
    await u.type(within(dialog).getByLabelText("Platform"), "discord");
    await u.type(within(dialog).getByLabelText("URL"), "https://discord.com/x");
    await u.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Disc")).toBeInTheDocument();
    expect(calls.find((c) => c.method === "POST")!.body).toMatchObject({ platform: "discord", url: "https://discord.com/x", visible: true });
    await u.click(screen.getByRole("button", { name: "Move Disc up" }));
    await waitFor(() => expect(calls.find((c) => c.path.endsWith("/order"))!.body).toEqual({ ids: ["s2", "s1"] }));
  });
});

describe("Navigation screen", () => {
  const item = (id: string, label: string, visible = true) => ({ id, label, targetType: "url", url: "/" + label.toLowerCase(), openNewTab: false, visible });

  it("shows an honest empty state", async () => {
    routes["GET /api/admin/navigation"] = { body: { items: [] } };
    wrap(<NavigationScreen />);
    expect(await screen.findByText(/No menu items yet/)).toBeInTheDocument();
  });

  it("add, hide, reorder, delete", async () => {
    const links = item("n1", "Links"), blog = item("n2", "Blog");
    routes["GET /api/admin/navigation"] = { body: { items: [links] } };
    routes["POST /api/admin/navigation"] = { status: 201, body: { items: [links, blog] } };
    routes["PUT /api/admin/navigation/n2"] = { body: { items: [links, { ...blog, visible: false }] } };
    routes["PUT /api/admin/navigation/order"] = { body: { items: [{ ...blog, visible: false }, links] } };
    routes["DELETE /api/admin/navigation/n1"] = { body: { items: [{ ...blog, visible: false }] } };
    const u = userEvent.setup();
    wrap(<NavigationScreen />);
    await u.click(await screen.findByRole("button", { name: "Add item" }));
    let dialog = await screen.findByRole("dialog");
    await u.type(within(dialog).getByLabelText("Label"), "Blog");
    await u.type(within(dialog).getByLabelText("Target URL"), "/blog");
    await u.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("button", { name: "Hide Blog" })).toBeInTheDocument();
    expect(calls.find((c) => c.method === "POST")!.body).toMatchObject({ label: "Blog", targetType: "url", url: "/blog", pageId: null, openNewTab: false, visible: true });
    await u.click(screen.getByRole("button", { name: "Hide Blog" }));
    expect(await screen.findByText("(hidden)")).toBeInTheDocument();
    expect(calls.find((c) => c.path === "/api/admin/navigation/n2")!.body).toMatchObject({ visible: false, label: "Blog" });
    await u.click(screen.getByRole("button", { name: "Move Blog up" }));
    await waitFor(() => expect(calls.find((c) => c.path.endsWith("/order"))!.body).toEqual({ ids: ["n2", "n1"] }));
    await u.click(screen.getByRole("button", { name: "Delete Links" }));
    dialog = await screen.findByRole("dialog");
    await u.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.queryByText("Links")).toBeNull());
  });

  it("shows the server's message for a bad target and keeps the dialog open", async () => {
    routes["GET /api/admin/navigation"] = { body: { items: [] } };
    routes["POST /api/admin/navigation"] = { status: 400, body: { error: { code: "validation_failed", message: "url: must be a path starting with / or a full http(s) link" } } };
    const u = userEvent.setup();
    wrap(<NavigationScreen />);
    await u.click(await screen.findByRole("button", { name: "Add item" }));
    const dialog = await screen.findByRole("dialog");
    await u.type(within(dialog).getByLabelText("Label"), "X");
    await u.type(within(dialog).getByLabelText("Target"), "javascript:alert(1)");
    await u.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("must be a path");
  });
});

describe("Admin session expiry", () => {
  it("a 401 from an admin call returns to the login screen", async () => {
    routes["GET /api/auth/me"] = { body: { authenticated: true } };
    routes["GET /api/admin/navigation"] = { status: 401, body: { error: { code: "unauthorized", message: "Sign in required." } } };
    window.history.pushState({}, "", "/navigation");
    render(<AdminApp basename="/" />);
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    window.history.pushState({}, "", "/");
  });
});

const site = (over: any = {}) => ({
  profile: { displayName: "", username: "", shortBio: "", extendedBio: "", subtitles: [], typingEnabled: false, statusText: "", onlineMode: "hidden", location: null, timezone: null, avatarUrl: null, bannerUrl: null, badges: [], ...over.profile },
  social: over.social ?? [], navigation: over.navigation ?? [], site: { title: "3ellwa.space" },
});

describe("Public homepage", () => {
  afterEach(() => window.history.pushState({}, "", "/"));

  it("empty site shows the neutral empty state", async () => {
    routes["GET /api/public/site"] = { body: site() };
    render(<PublicApp />);
    expect(await screen.findByRole("heading", { name: "This space is being set up" })).toBeInTheDocument();
  });

  it("renders the profile, menu, social links, badges, and status", async () => {
    routes["GET /api/public/site"] = {
      body: site({
        profile: { displayName: "Ada", username: "ada", shortBio: "Short bio here", statusText: "Building", onlineMode: "online", location: "Cairo", avatarUrl: "/media/a/x.png", badges: [{ label: "Verified" }], subtitles: ["Builder"] },
        social: [{ id: "1", platform: "github", label: null, url: "https://github.com/a", icon: null }],
        navigation: [{ id: "n", label: "Links", href: "/links", newTab: false }, { id: "m", label: "Blog", href: "https://example.com", newTab: true }],
      }),
    };
    render(<PublicApp />);
    expect(await screen.findByRole("heading", { name: "Ada" })).toBeInTheDocument();
    expect(screen.getByText("@ada")).toBeInTheDocument();
    expect(screen.getByText("Short bio here")).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(screen.getByText("Building")).toBeInTheDocument();
    expect(screen.getByText("Online.")).toBeInTheDocument();
    expect(screen.getByText("Cairo")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Ada's avatar" })).toHaveAttribute("src", "/media/a/x.png");
    const gh = screen.getByRole("link", { name: "github" });
    expect(gh).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(screen.getByRole("link", { name: "Links" })).toHaveAttribute("href", "/links");
    const blog = screen.getByRole("link", { name: "Blog" });
    expect(blog).toHaveAttribute("target", "_blank");
    expect(blog).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(document.title).toBe("3ellwa.space");
  });

  it("shows an error with retry when the site cannot load", async () => {
    routes["GET /api/public/site"] = [{ status: 500, body: { error: { code: "x", message: "no" } } }, { body: site({ profile: { displayName: "Ada" } }) }];
    const u = userEvent.setup();
    render(<PublicApp />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load this page");
    await u.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "Ada" })).toBeInTheDocument();
  });

  it("unknown path shows the 404 view without calling the site API", async () => {
    window.history.pushState({}, "", "/nope");
    render(<PublicApp />);
    await waitFor(() => expect(calls).toContainEqual(expect.objectContaining({ path: "/api/public/pages/nope", method: "GET" })));
    expect(screen.getByText("Page not found")).toBeInTheDocument();
  });
});

describe("TypingSubtitle", () => {
  const mm = (reduce: boolean) => vi.stubGlobal("matchMedia", (q: string) => ({ matches: reduce && q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {} }));

  it("reduced motion: static first phrase, no typing, all phrases readable by screen readers", () => {
    mm(true);
    render(<TypingSubtitle phrases={["Builder", "Gamer"]} typing />);
    expect(screen.getAllByText("Builder").length).toBeGreaterThan(0);
    expect(document.querySelector('[aria-hidden="true"]')!.textContent).toBe("Builder");
    expect(screen.getByText("Builder. Gamer")).toBeInTheDocument();
  });

  it("types out the phrase over time when motion is allowed", async () => {
    mm(false);
    vi.useFakeTimers();
    render(<TypingSubtitle phrases={["Hey"]} typing />);
    const shown = () => document.querySelector('[aria-hidden="true"]')!.textContent!.replace(/\s/g, "");
    expect(shown()).toBe("");
    await act(async () => { await vi.advanceTimersByTimeAsync(300 + 60 * 3 + 10); });
    expect(shown()).toBe("Hey");
  });

  it("rotates phrases without typing", async () => {
    mm(false);
    vi.useFakeTimers();
    render(<TypingSubtitle phrases={["A", "B"]} typing={false} />);
    expect(document.querySelector('[aria-hidden="true"]')!.textContent).toBe("A");
    await act(async () => { await vi.advanceTimersByTimeAsync(3600); });
    expect(document.querySelector('[aria-hidden="true"]')!.textContent).toBe("B");
  });
});
