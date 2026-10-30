import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MediaScreen from "./admin/media/MediaScreen";
import { centeredOffset, clampOffset, coverScale, fitWithin, formatBytes, frameFor, sourceRect } from "./shared/imageTools";
import { checkLibraryFile } from "./shared/media";
import type { MediaItem } from "./shared/media";
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
afterEach(() => { vi.unstubAllGlobals(); });

const asset = (id: string, name: string, over: Partial<MediaItem> = {}): MediaItem => ({
  id, filename: name, name, mimeType: "image/png", sizeBytes: 2048, width: 100, height: 50, altText: null, folderId: null,
  url: `/media/${id}/${name}`, createdAt: "2026-01-01 10:00:00", updatedAt: "2026-01-01 10:00:00", usedCount: 0, ...over,
});
const list = (items: MediaItem[]): Reply => ({ body: { items, totalAssets: items.length, totalBytes: items.length * 2048 } });
const wrap = () => render(<ToastProvider><MediaScreen /></ToastProvider>);

describe("image geometry", () => {
  it("fitWithin never upscales and keeps the aspect ratio", () => {
    expect(fitWithin(800, 600, 2000)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(4000, 3000, 2000)).toEqual({ width: 2000, height: 1500 });
    expect(fitWithin(4000, 3000, 0)).toEqual({ width: 4000, height: 3000 });
  });
  it("a centred square crop of a wide image takes the middle", () => {
    const v = { frameW: 200, frameH: 200, imgW: 1000, imgH: 500, zoom: 1, offsetX: 0, offsetY: 0 };
    expect(coverScale(v)).toBe(0.4);
    const r = sourceRect({ ...v, ...centeredOffset(v) });
    expect([Math.round(r.x), Math.round(r.y), Math.round(r.w), Math.round(r.h)]).toEqual([250, 0, 500, 500]);
  });
  it("panning is clamped so the frame stays covered, and the crop stays inside the image", () => {
    const v = { frameW: 200, frameH: 200, imgW: 1000, imgH: 500, zoom: 2, offsetX: 0, offsetY: 0 };
    expect(clampOffset({ ...v, offsetX: 50, offsetY: 50 })).toEqual({ offsetX: 0, offsetY: 0 });
    const far = sourceRect({ ...v, offsetX: -99999, offsetY: -99999 });
    expect(far.x).toBeGreaterThanOrEqual(0);
    expect(far.x + far.w).toBeLessThanOrEqual(1000.0001);
    expect(far.y + far.h).toBeLessThanOrEqual(500.0001);
  });
  it("frameFor fits an aspect inside a box; formatBytes is readable", () => {
    expect(frameFor(3, 600, 400)).toEqual({ frameW: 600, frameH: 200 });
    expect(frameFor(1, 600, 400)).toEqual({ frameW: 400, frameH: 400 });
    expect([formatBytes(512), formatBytes(2048), formatBytes(5 * 1048576)]).toEqual(["512 B", "2.0 KB", "5.0 MB"]);
  });
  it("checkLibraryFile refuses wrong types and files over 8 MB", () => {
    expect(checkLibraryFile(new File(["x"], "a.png", { type: "image/png" }))).toBeNull();
    expect(checkLibraryFile(new File(["x"], "a.svg", { type: "image/svg+xml" }))).toMatch(/only PNG/);
    expect(checkLibraryFile(new File([new Uint8Array(9 * 1048576)], "big.png", { type: "image/png" }))).toMatch(/8 MB/);
  });
});

describe("MediaScreen", () => {
  it("lists images with size and an In use badge, and a friendly empty state", async () => {
    routes["GET /api/admin/media"] = list([asset("a1", "cat.png", { usedCount: 2 }), asset("a2", "dog.png")]);
    routes["GET /api/admin/media/folders"] = { body: { items: [] } };
    wrap();
    expect(await screen.findByRole("button", { name: "Open cat.png" })).toBeInTheDocument();
    expect(screen.getByText("In use")).toBeInTheDocument();
    expect(screen.getAllByText(/100×50/).length).toBe(2);
  });

  it("shows the empty state when there are no images", async () => {
    routes["GET /api/admin/media"] = list([]);
    routes["GET /api/admin/media/folders"] = { body: { items: [] } };
    wrap();
    expect(await screen.findByText("No images yet.")).toBeInTheDocument();
  });

  it("searching asks the server with ?q=", async () => {
    routes["GET /api/admin/media"] = list([asset("a1", "cat.png")]);
    routes["GET /api/admin/media?q=cat"] = list([asset("a1", "cat.png")]);
    routes["GET /api/admin/media/folders"] = { body: { items: [] } };
    wrap();
    await screen.findByRole("button", { name: "Open cat.png" });
    await userEvent.type(screen.getByLabelText("Search images"), "cat");
    await waitFor(() => expect(calls.some((c) => c.path === "/api/admin/media?q=cat")).toBe(true));
  });

  it("creates a folder", async () => {
    routes["GET /api/admin/media"] = list([]);
    routes["GET /api/admin/media/folders"] = { body: { items: [] } };
    routes["POST /api/admin/media/folders"] = { status: 201, body: { items: [{ id: "f1", name: "Trips", createdAt: "x", assetCount: 0 }] } };
    routes["GET /api/admin/media?folder=f1"] = list([]);
    wrap();
    await screen.findByText("No images yet.");
    await userEvent.click(screen.getByRole("button", { name: "New folder" }));
    await userEvent.type(screen.getByLabelText("Folder name"), "Trips");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(calls.find((c) => c.method === "POST" && c.path === "/api/admin/media/folders")?.body).toEqual({ name: "Trips" }));
  });

  it("uploading several small files posts each one", async () => {
    routes["GET /api/admin/media"] = list([]);
    routes["GET /api/admin/media/folders"] = { body: { items: [] } };
    routes["POST /api/admin/media/upload"] = [
      { status: 201, body: { asset: asset("n1", "one.png") } },
      { status: 201, body: { asset: asset("n2", "two.png") } },
    ];
    wrap();
    await screen.findByText("No images yet.");
    const input = screen.getByLabelText("Upload images") as HTMLInputElement;
    await userEvent.upload(input, [new File(["a"], "one.png", { type: "image/png" }), new File(["b"], "two.png", { type: "image/png" })]);
    await waitFor(() => expect(calls.filter((c) => c.method === "POST" && c.path === "/api/admin/media/upload").length).toBe(2));
    expect(await screen.findByText("2 images uploaded.")).toBeInTheDocument();
  });

  it("a wrong file type is refused before anything is sent", async () => {
    routes["GET /api/admin/media"] = list([]);
    routes["GET /api/admin/media/folders"] = { body: { items: [] } };
    wrap();
    await screen.findByText("No images yet.");
    const input = screen.getByLabelText("Upload images") as HTMLInputElement;
    await userEvent.upload(input, [new File(["a"], "a.svg", { type: "image/svg+xml" }), new File(["b"], "b.svg", { type: "image/svg+xml" })], { applyAccept: false });
    expect(await screen.findByText(/only PNG, JPEG, WebP, and GIF/)).toBeInTheDocument();
    expect(calls.some((c) => c.path === "/api/admin/media/upload")).toBe(false);
  });

  it("renaming sends name, description, and folder", async () => {
    routes["GET /api/admin/media"] = list([asset("a1", "cat.png")]);
    routes["GET /api/admin/media/folders"] = { body: { items: [] } };
    routes["GET /api/admin/media/a1/usage"] = { body: { usage: [] } };
    routes["PUT /api/admin/media/a1"] = { body: { asset: asset("a1", "kitten.png", { altText: "A kitten" }) } };
    wrap();
    await userEvent.click(await screen.findByRole("button", { name: "Open cat.png" }));
    const dlg = await screen.findByRole("dialog", { name: "cat.png" });
    const name = within(dlg).getByLabelText("Name");
    await userEvent.clear(name);
    await userEvent.type(name, "kitten");
    await userEvent.type(within(dlg).getByLabelText("Description (alt text)"), "A kitten");
    await userEvent.click(within(dlg).getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(calls.find((c) => c.method === "PUT")?.body).toEqual({ name: "kitten", altText: "A kitten", folderId: null }));
  });

  it("deleting an image in use warns where it is used, then deletes", async () => {
    routes["GET /api/admin/media"] = list([asset("a1", "cat.png", { usedCount: 1 })]);
    routes["GET /api/admin/media/folders"] = { body: { items: [] } };
    routes["GET /api/admin/media/a1/usage"] = { body: { usage: [{ type: "link", label: "Link: My blog" }] } };
    routes["DELETE /api/admin/media/a1"] = { body: { ok: true } };
    wrap();
    await userEvent.click(await screen.findByRole("button", { name: "Open cat.png" }));
    const dlg = await screen.findByRole("dialog", { name: "cat.png" });
    await userEvent.click(within(dlg).getByRole("button", { name: "Delete" }));
    const confirm = await screen.findByRole("dialog", { name: "Delete this image?" });
    expect(await within(confirm).findByText("Link: My blog")).toBeInTheDocument();
    await userEvent.click(within(confirm).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(calls.some((c) => c.method === "DELETE" && c.path === "/api/admin/media/a1")).toBe(true));
  });

  it("selecting images shows the bulk bar and bulk delete uses the bulk endpoint", async () => {
    routes["GET /api/admin/media"] = list([asset("a1", "cat.png"), asset("a2", "dog.png")]);
    routes["GET /api/admin/media/folders"] = { body: { items: [] } };
    routes["GET /api/admin/media/a1/usage"] = { body: { usage: [] } };
    routes["GET /api/admin/media/a2/usage"] = { body: { usage: [] } };
    routes["POST /api/admin/media/bulk"] = { body: { ok: true, count: 2 } };
    wrap();
    await userEvent.click(await screen.findByLabelText("Select cat.png"));
    await userEvent.click(screen.getByLabelText("Select dog.png"));
    const bar = screen.getByRole("region", { name: "Selected images" });
    expect(within(bar).getByText("2 selected")).toBeInTheDocument();
    await userEvent.click(within(bar).getByRole("button", { name: "Delete" }));
    const confirm = await screen.findByRole("dialog", { name: "Delete 2 images?" });
    await userEvent.click(within(confirm).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(calls.find((c) => c.path === "/api/admin/media/bulk")?.body).toEqual({ action: "delete", ids: ["a1", "a2"] }));
  });
});
