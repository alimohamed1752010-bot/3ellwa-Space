import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../../shared/api";
import { Button, Card, CardBody, CardHeader, Checkbox, Input, Select, Textarea, useToast } from "../../shared/ui";
import { useUnsavedGuard } from "../unsaved";
import ImageField from "./ImageField";
import SocialLinks from "./SocialLinks";
import { toPayload } from "./types";
import type { Profile } from "./types";

export default function ProfileScreen() {
  const toast = useToast();
  const [saved, setSaved] = useState<Profile | null>(null);
  const [form, setForm] = useState<Profile | null>(null);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [badge, setBadge] = useState("");
  // Subtitles are edited as text (one per line) and converted on save.
  const [subtitleText, setSubtitleText] = useState("");

  const load = useCallback(() => {
    setLoadError("");
    api.get<{ profile: Profile }>("/api/admin/profile")
      .then((r) => { setSaved(r.profile); setForm(r.profile); setSubtitleText(r.profile.subtitles.join("\n")); })
      .catch((e) => setLoadError(e instanceof ApiError ? e.message : "Could not load the profile."));
  }, []);
  useEffect(load, [load]);

  const current = useMemo(() => (form ? { ...form, subtitles: subtitleText.split("\n").map((s) => s.trim()).filter(Boolean) } : null), [form, subtitleText]);
  const dirty = !!current && !!saved && JSON.stringify(toPayload(current)) !== JSON.stringify(toPayload(saved));
  useUnsavedGuard(dirty);

  if (loadError) return <Screen><Card className="p-6"><p role="alert" className="text-sm text-danger">{loadError}</p><Button className="mt-4" variant="secondary" onClick={load}>Try again</Button></Card></Screen>;
  if (!form || !current || !saved) return <Screen><p role="status" className="text-sm text-muted">Loading profile…</p></Screen>;

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const patch = (v: Partial<Profile>) => setForm((f) => (f ? { ...f, ...v } : f)); // functional, so two uploads finishing together cannot overwrite each other

  async function save() {
    if (!current) return;
    setSaving(true); setError("");
    try {
      const r = await api.put<{ profile: Profile }>("/api/admin/profile", toPayload(current));
      setSaved(r.profile); setForm(r.profile); setSubtitleText(r.profile.subtitles.join("\n"));
      toast.show("Profile saved. It is live now.", "success");
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Could not save.";
      setError(msg); toast.show(msg, "error");
    } finally { setSaving(false); }
  }

  function addBadge() {
    const label = badge.trim();
    if (!label || form!.badges.length >= 10) return;
    setForm((f) => (f ? { ...f, badges: [...f.badges, { label }] } : f)); setBadge("");
  }

  return (
    <Screen>
      <form className="mt-6 flex flex-col gap-6" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Card>
          <CardHeader title="Images" />
          <CardBody className="flex flex-col gap-6">
            <ImageField label="Banner" purpose="banner" url={form.bannerUrl} onChange={(a) => patch({ bannerAssetId: a?.id ?? null, bannerUrl: a?.url ?? null })} />
            <ImageField label="Avatar" purpose="avatar" round url={form.avatarUrl} onChange={(a) => patch({ avatarAssetId: a?.id ?? null, avatarUrl: a?.url ?? null })} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Identity" />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Input label="Display name" maxLength={80} value={form.displayName} onChange={(e) => set("displayName", e.target.value)} />
            <Input label="Username" maxLength={40} value={form.username} onChange={(e) => set("username", e.target.value)} hint="Shown as @username." />
            <div className="sm:col-span-2"><Textarea label="Short bio" maxLength={280} value={form.shortBio} onChange={(e) => set("shortBio", e.target.value)} hint={`${form.shortBio.length}/280`} className="min-h-20" /></div>
            <div className="sm:col-span-2"><Textarea label="Extended bio" maxLength={5000} value={form.extendedBio} onChange={(e) => set("extendedBio", e.target.value)} className="min-h-32" /></div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Subtitle and status" />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Textarea label="Animated subtitle" value={subtitleText} onChange={(e) => setSubtitleText(e.target.value)} hint="One line per phrase, up to 10. With several lines the text rotates." className="min-h-20" />
            </div>
            <div className="sm:col-span-2"><Checkbox label="Typing effect" hint="Types each phrase out. Skipped for visitors who prefer reduced motion." checked={form.typingEnabled} onChange={(e) => set("typingEnabled", e.target.checked)} /></div>
            <Input label="Custom status" maxLength={100} value={form.statusText} onChange={(e) => set("statusText", e.target.value)} />
            <Select label="Online indicator" value={form.onlineMode} onChange={(e) => set("onlineMode", e.target.value as Profile["onlineMode"])}>
              <option value="hidden">Hidden</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
              <option value="auto" disabled>Automatic (needs Discord, Part 7)</option>
            </Select>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Location and time" />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Input label="Location text" maxLength={80} value={form.locationText} onChange={(e) => set("locationText", e.target.value)} placeholder="Cairo, Egypt" />
            <div className="flex items-end pb-2"><Checkbox label="Show location" checked={form.showLocation} onChange={(e) => set("showLocation", e.target.checked)} /></div>
            <div>
              <Input label="Time zone" list="tzlist" value={form.timezone ?? ""} onChange={(e) => set("timezone", e.target.value || null)} placeholder="Africa/Cairo" />
              <datalist id="tzlist">{timeZones().map((z) => <option key={z} value={z} />)}</datalist>
              <button type="button" className="mt-1.5 text-xs text-accent-soft hover:underline" onClick={() => set("timezone", Intl.DateTimeFormat().resolvedOptions().timeZone)}>Use this device’s time zone</button>
            </div>
            <div className="flex items-start pt-7"><Checkbox label="Show my local time" hint="Needs a time zone." checked={form.showLocalTime} onChange={(e) => set("showLocalTime", e.target.checked)} /></div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Badges" description="Small labels such as “Verified” next to your name. Up to 10." />
          <CardBody className="flex flex-col gap-3">
            {form.badges.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {form.badges.map((b, i) => (
                  <li key={i} className="inline-flex items-center gap-1 rounded-full border border-line-strong bg-raised py-1 pl-3 pr-1 text-sm">
                    {b.label}
                    <button type="button" aria-label={`Remove badge ${b.label}`} className="grid size-6 place-items-center rounded-full text-muted hover:bg-line hover:text-ink" onClick={() => set("badges", form.badges.filter((_, j) => j !== i))}>×</button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-end gap-2">
              <div className="flex-1"><Input label="New badge" maxLength={30} value={badge} onChange={(e) => setBadge(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addBadge(); } }} /></div>
              <Button variant="secondary" onClick={addBadge} disabled={!badge.trim() || form.badges.length >= 10}>Add badge</Button>
            </div>
          </CardBody>
        </Card>

        <div className="sticky bottom-3 z-10 flex items-center justify-between gap-3 rounded-card border border-line-strong bg-surface/95 px-4 py-3 backdrop-blur">
          <p className={`text-sm ${error ? "text-danger" : "text-muted"}`} role={error ? "alert" : "status"}>{error || (dirty ? "Unsaved changes" : "All changes saved")}</p>
          <div className="flex gap-2">
            {dirty && <Button variant="ghost" onClick={() => { setForm(saved); setSubtitleText(saved.subtitles.join("\n")); setError(""); }}>Discard</Button>}
            <Button type="submit" loading={saving} disabled={!dirty}>Save profile</Button>
          </div>
        </div>
      </form>

      <div className="mt-6"><SocialLinks /></div>
    </Screen>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="rise">
      <h1 className="text-xl font-medium">Profile</h1>
      <p className="mt-1 text-sm text-muted">What visitors see at the top of your homepage. Saved changes go live right away.</p>
      {children}
    </div>
  );
}

function timeZones(): string[] {
  try { return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("timeZone"); } catch { return []; }
}
