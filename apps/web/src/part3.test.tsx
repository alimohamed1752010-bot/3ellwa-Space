import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LinksScreen from "./admin/links/LinksScreen";
import { ImportModal, qrSvg } from "./admin/links/Panels";
import { EMPTY_DRAFT, NO_FILTERS, checkUrl, draftError, filterLinks, fromLocalInput, toLocalInput, toPayload } from "./admin/links/types";
import type { Category, LinkItem } from "./admin/links/types";
import PublicApp from "./public/PublicApp";
import { ToastProvider } from "./shared/ui";

type Reply = { status?: number; body: unknown };
let routes: Record<string, Reply[] | Reply>;
const calls: Array<{ path: string; method: string; body: any }> = [];

beforeEach(() => {
  calls.length = 0;
  routes = {};
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
afterEach(() => { vi.unstubAllGlobals(); window.history.pushState({}, "", "/"); });

const link = (id: string, title: string, over: Partial<LinkItem> = {}): LinkItem => ({
  id, categoryId: null, title, url: `https://example.com/${id}`, description: null, icon: null, imageAssetId: null, imageUrl: null, color: null, background: null,
  badge: null, hoverAnimation: "none", openNewTab: true, featured: false, visible: true, enabled: true, publishAt: null, expiresAt: null, sortOrder: 0,
  clicksTotal: 0, clicks7d: 0, status: "live", ...over,
});
const cat = (id: string, name: string): Category => ({ id, name, description: null, color: null, visible: true, sortOrder: 0, linkCount: 0 });
const wrap = (ui: React.ReactNode) => render(<ToastProvider>{ui}</ToastProvider>);

describe("link helpers", () => {
  it("checkUrl accepts http(s) and mailto, refuses everything unsafe", () => {
    for (const ok of ["https://example.com", "http://a.b/c?d=1#e", "mailto:me@example.com"]) expect(checkUrl(ok)).toBeNull();
    for (const bad of ["", "javascript:alert(1)", "data:text/html,x", "vbscript:x", "file:///etc/passwd", "/relative", "//evil.example", "example.com", "https://a b.com", "https://u:p@example.com", "https://" + "a".repeat(2100)])
      expect(checkUrl(bad), bad).not.toBeNull();
  });
  it("filterLinks searches title, URL and description, and filters by status and category", () => {
    const items = [link("a", "Alpha", { categoryId: "c1" }), link("b", "Beta", { status: "expired", description: "gaming stuff" }), link("c", "Gamma", { badge: "New" })];
    expect(filterLinks(items, { ...NO_FILTERS, q: "alp" }).map((l) => l.id)).toEqual(["a"]);
    expect(filterLinks(items, { ...NO_FILTERS, q: "GAMING" }).map((l) => l.id)).toEqual(["b"]);
    expect(filterLinks(items, { ...NO_FILTERS, status: "expired" }).map((l) => l.id)).toEqual(["b"]);
    expect(filterLinks(items, { ...NO_FILTERS, categoryId: "c1" }).map((l) => l.id)).toEqual(["a"]);
    expect(filterLinks(items, { ...NO_FILTERS, categoryId: "none" }).map((l) => l.id)).toEqual(["b", "c"]);
    expect(filterLinks(items, { ...NO_FILTERS, q: "new" }).map((l) => l.id)).toEqual(["c"]);
  });
  it("datetime-local conversion round-trips and empty means none", () => {
    const iso = "2026-12-24T18:30:00.000Z";
    expect(fromLocalInput(toLocalInput(iso))).toBe(iso);
    expect(toLocalInput(null)).toBe("");
    expect(fromLocalInput("")).toBeNull();
  });
  it("draftError and toPayload", () => {
    expect(draftError({ ...EMPTY_DRAFT })).toMatch(/title/i);
    expect(draftError({ ...EMPTY_DRAFT, title: "x", url: "javascript:1" })).not.toBeNull();
    expect(draftError({ ...EMPTY_DRAFT, title: "x", url: "https://e.com", publishAt: "2026-05-02T10:00", expiresAt: "2026-05-01T10:00" })).toMatch(/after/);
    expect(draftError({ ...EMPTY_DRAFT, title: "x", url: "https://e.com" })).toBeNull();
    expect(toPayload({ ...EMPTY_DRAFT, title: " T ", url: " https://e.com ", categoryId: "" })).toMatchObject({ title: "T", url: "https://e.com", categoryId: null, description: null, publishAt: null });
  });
  it("qrSvg returns an SVG", () => { expect(qrSvg("https://example.com/go/abc")).toMatch(/^<svg/); });
});

describe("Links screen", () => {
  const two = [link("a", "Alpha", { clicksTotal: 3, clicks7d: 2 }), link("b", "Beta", { status: "disabled", enabled: false })];

  it("shows an honest empty state with an Add link action", async () => {
    routes["GET /api/admin/links"] = { body: { items: [], categories: [] } };
    wrap(<LinksScreen />);
    expect(await screen.findByText("No links yet.")).toBeInTheDocument();
  });

  it("shows a load error and retries", async () => {
    routes["GET /api/admin/links"] = [{ status: 500, body: { error: { code: "x", message: "Boom" } } }, { body: { items: two, categories: [] } }];
    const u = userEvent.setup();
    wrap(<LinksScreen />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Boom");
    await u.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Alpha")).toBeInTheDocument();
  });

  it("lists links with status and clicks; search disables reordering and can be cleared", async () => {
    routes["GET /api/admin/links"] = { body: { items: two, categories: [] } };
    const u = userEvent.setup();
    wrap(<LinksScreen />);
    expect(await screen.findByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText(/3 clicks \(2 this week\)/)).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Links" })).getByText("Disabled")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Drag to reorder Alpha" })).toBeEnabled();
    await u.type(screen.getByLabelText("Search links"), "beta");
    expect(screen.queryByText("Alpha")).toBeNull();
    expect(screen.getByRole("button", { name: "Drag to reorder Beta" })).toBeDisabled();
    await u.clear(screen.getByLabelText("Search links"));
    await u.type(screen.getByLabelText("Search links"), "zzz");
    await u.click(await screen.findByRole("button", { name: "Clear search and filters" }));
    expect(await screen.findByText("Alpha")).toBeInTheDocument();
  });

  it("add link: refuses a javascript: URL without calling the server, then saves a good one", async () => {
    routes["GET /api/admin/links"] = [{ body: { items: [], categories: [cat("c1", "Games")] } }, { body: { items: [link("n1", "New", { categoryId: "c1" })], categories: [cat("c1", "Games")] } }];
    routes["POST /api/admin/links"] = { status: 201, body: { item: link("n1", "New", { categoryId: "c1" }) } };
    const u = userEvent.setup();
    wrap(<LinksScreen />);
    await u.click((await screen.findAllByRole("button", { name: "Add link" }))[0]);
    const d = await screen.findByRole("dialog");
    await u.type(within(d).getByLabelText("Title"), "New");
    await u.type(within(d).getByLabelText("URL"), "javascript:alert(1)");
    await u.click(within(d).getByRole("button", { name: "Add link" }));
    expect(await within(d).findByRole("alert")).toHaveTextContent(/http\(s\)/);
    expect(calls.some((c) => c.method === "POST")).toBe(false);
    await u.clear(within(d).getByLabelText("URL"));
    await u.type(within(d).getByLabelText("URL"), "https://example.com/new");
    await u.selectOptions(within(d).getByLabelText("Category"), "c1");
    await u.click(within(d).getByRole("button", { name: "Add link" }));
    await waitFor(() => expect(calls.find((c) => c.method === "POST")!.body).toMatchObject({ title: "New", url: "https://example.com/new", categoryId: "c1", openNewTab: true, enabled: true }));
    expect(await screen.findByText("New")).toBeInTheDocument();
  });

  it("shows the server's message when save fails and keeps the editor open", async () => {
    routes["GET /api/admin/links"] = { body: { items: [], categories: [] } };
    routes["POST /api/admin/links"] = { status: 400, body: { error: { code: "validation_failed", message: "color: must be a color like #8b5cf6" } } };
    const u = userEvent.setup();
    wrap(<LinksScreen />);
    await u.click((await screen.findAllByRole("button", { name: "Add link" }))[0]);
    const d = await screen.findByRole("dialog");
    await u.type(within(d).getByLabelText("Title"), "T");
    await u.type(within(d).getByLabelText("URL"), "https://example.com");
    await u.click(within(d).getByRole("button", { name: "Add link" }));
    expect(await within(d).findByRole("alert")).toHaveTextContent("color:");
  });

  it("enable/disable toggle sends the full link with the flag flipped", async () => {
    routes["GET /api/admin/links"] = { body: { items: two, categories: [] } };
    routes["PUT /api/admin/links/a"] = { body: { item: { ...two[0], enabled: false, status: "disabled" } } };
    const u = userEvent.setup();
    wrap(<LinksScreen />);
    await u.click(await screen.findByRole("button", { name: "Disable Alpha" }));
    await waitFor(() => expect(calls.find((c) => c.method === "PUT")!.body).toMatchObject({ title: "Alpha", url: "https://example.com/a", enabled: false }));
    expect(await screen.findByRole("button", { name: "Enable Alpha" })).toBeInTheDocument();
  });

  it("bulk: select, disable, then delete with confirmation", async () => {
    routes["GET /api/admin/links"] = { body: { items: two, categories: [] } };
    routes["POST /api/admin/links/bulk"] = [
      { body: { items: [{ ...two[0], enabled: false, status: "disabled" }, two[1]], categories: [] } },
      { body: { items: [two[1]], categories: [] } },
    ];
    const u = userEvent.setup();
    wrap(<LinksScreen />);
    await u.click(await screen.findByLabelText("Select Alpha"));
    const bar = screen.getByRole("region", { name: "Bulk actions" });
    expect(within(bar).getByText("1 selected")).toBeInTheDocument();
    await u.click(within(bar).getByRole("button", { name: "Disable" }));
    await waitFor(() => expect(calls.find((c) => c.path.endsWith("/bulk"))!.body).toEqual({ ids: ["a"], action: "disable" }));
    await u.click(within(screen.getByRole("region", { name: "Bulk actions" })).getByRole("button", { name: "Delete" }));
    const d = await screen.findByRole("dialog", { name: "Delete link?" });
    await u.click(within(d).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.queryByText("Alpha")).toBeNull());
    expect(calls.filter((c) => c.path.endsWith("/bulk")).at(-1)!.body).toEqual({ ids: ["a"], action: "delete" });
  });

  it("reorder: up/down is not offered here, but dragging is announced as a keyboard-capable handle", async () => {
    routes["GET /api/admin/links"] = { body: { items: two, categories: [] } };
    wrap(<LinksScreen />);
    const h = await screen.findByRole("button", { name: "Drag to reorder Alpha" });
    expect(h).toHaveAttribute("aria-roledescription", "sortable");
  });
});

describe("Import dialog", () => {
  it("lists every server error and imports nothing", async () => {
    routes["POST /api/admin/links/import"] = { status: 400, body: { error: { code: "import_invalid", message: "Import refused", errors: ["Link #2 (url): must be a full http(s) or mailto link", "Link #5 (title): too small"] } } };
    const u = userEvent.setup();
    const done = vi.fn();
    wrap(<ImportModal onClose={() => {}} onDone={done} />);
    const box = screen.getByLabelText("Or paste JSON");
    await u.click(box);
    await u.paste('{"version":1,"links":[]}');
    await u.click(screen.getByRole("button", { name: "Import" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Nothing was imported");
    expect(alert).toHaveTextContent("Link #2");
    expect(alert).toHaveTextContent("Link #5");
    expect(done).not.toHaveBeenCalled();
  });
  it("rejects non-JSON locally without calling the server", async () => {
    const u = userEvent.setup();
    wrap(<ImportModal onClose={() => {}} onDone={() => {}} />);
    await u.click(screen.getByLabelText("Or paste JSON"));
    await u.paste("not json");
    await u.click(screen.getByRole("button", { name: "Import" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("not valid JSON");
    expect(calls.length).toBe(0);
  });
});

describe("Public links", () => {
  const pl = (id: string, title: string, over: object = {}) => ({ id, title, description: null, icon: null, imageUrl: null, color: null, background: null, badge: null, hoverAnimation: "none", newTab: true, featured: false, href: `/go/${id}`, ...over });
  const site = { profile: { displayName: "Ada", username: "ada", shortBio: "Hi", extendedBio: "", subtitles: [], typingEnabled: false, statusText: "", onlineMode: "hidden", location: null, timezone: null, avatarUrl: null, bannerUrl: null, badges: [] }, social: [], navigation: [], site: { title: "Ada" } };

  it("/links groups by category and every link goes through /go", async () => {
    routes["GET /api/public/links"] = { body: { groups: [
      { id: "c1", name: "Games", description: "Stuff I play", color: "#8b5cf6", links: [pl("a", "Alpha", { badge: "New", newTab: true })] },
      { id: null, name: null, description: null, color: null, links: [pl("b", "Beta", { newTab: false })] },
    ], featured: [], total: 2 } };
    window.history.pushState({}, "", "/links");
    render(<PublicApp />);
    expect(await screen.findByRole("heading", { name: "Games" })).toBeInTheDocument();
    const a = screen.getByRole("link", { name: /Alpha/ });
    expect(a).toHaveAttribute("href", "/go/a");
    expect(a).toHaveAttribute("target", "_blank");
    expect(a.getAttribute("rel")).toContain("noopener");
    expect(screen.getByRole("link", { name: /Beta/ })).not.toHaveAttribute("target");
    expect(screen.getByText("New")).toBeInTheDocument();
  });

  it("/links empty state", async () => {
    routes["GET /api/public/links"] = { body: { groups: [], featured: [], total: 0 } };
    window.history.pushState({}, "", "/links");
    render(<PublicApp />);
    expect(await screen.findByText("No links yet")).toBeInTheDocument();
  });

  it("/links error state retries", async () => {
    routes["GET /api/public/links"] = [{ status: 500, body: {} }, { body: { groups: [{ id: null, name: null, description: null, color: null, links: [pl("a", "Alpha")] }], featured: [], total: 1 } }];
    window.history.pushState({}, "", "/links");
    const u = userEvent.setup();
    render(<PublicApp />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load links");
    await u.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("link", { name: /Alpha/ })).toBeInTheDocument();
  });

  it("homepage shows featured links and a link to all", async () => {
    routes["GET /api/public/site"] = { body: site };
    routes["GET /api/public/links"] = { body: { groups: [{ id: null, name: null, description: null, color: null, links: [pl("a", "Alpha", { featured: true }), pl("b", "Beta"), pl("c", "Gamma")] }], featured: [pl("a", "Alpha", { featured: true })], total: 3 } };
    render(<PublicApp />);
    expect(await screen.findByRole("heading", { name: "Featured links" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Alpha/ })).toHaveAttribute("href", "/go/a");
    expect(screen.queryByRole("link", { name: /Beta/ })).toBeNull();
    expect(screen.getByRole("link", { name: /All 3 links/ })).toHaveAttribute("href", "/links");
  });

  it("homepage still renders when the links request fails", async () => {
    routes["GET /api/public/site"] = { body: site };
    routes["GET /api/public/links"] = { status: 500, body: {} };
    render(<PublicApp />);
    expect(await screen.findByRole("heading", { name: "Ada" })).toBeInTheDocument();
    expect(screen.queryByText(/Could not load links/)).toBeNull();
  });
});
