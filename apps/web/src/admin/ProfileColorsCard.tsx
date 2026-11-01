import { Card, CardBody, CardHeader, Input, Select } from "../shared/ui";
import { DEFAULT_PROFILE_COLORS, PROFILE_PRESETS, profileCardLook, type ProfileColors } from "../shared/profileColors";
import type { ThemeTokens } from "../shared/theme";

interface Props {
  tokens: ThemeTokens;
  disabled: boolean;
  onChange: (next: ThemeTokens) => void;
}

export default function ProfileColorsCard({ tokens, disabled, onChange }: Props) {
  const pc: ProfileColors = tokens.profile ?? DEFAULT_PROFILE_COLORS;
  const look = profileCardLook(pc);
  const set = (patch: Partial<ProfileColors>) => onChange({ ...tokens, profile: { ...pc, ...patch } });

  return (
    <Card>
      <CardHeader
        title="Profile card colors"
        description="Give the profile card a color or a two-color gradient, like a Discord Nitro profile. Text color adjusts on its own so it stays readable."
      />
      <CardBody className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="Style"
            value={pc.mode}
            disabled={disabled}
            onChange={(e) => set({ mode: e.target.value as ProfileColors["mode"] })}
          >
            <option value="off">Off (normal card surface)</option>
            <option value="solid">Solid color</option>
            <option value="gradient">Gradient</option>
          </Select>
          {pc.mode === "gradient" && (
            <Input
              label="Gradient angle"
              type="number"
              min={0}
              max={360}
              value={pc.angle}
              disabled={disabled}
              onChange={(e) => set({ angle: Math.min(360, Math.max(0, Math.round(Number(e.target.value) || 0))) })}
            />
          )}
          {pc.mode !== "off" && (
            <Input label="Primary color" type="color" value={pc.primary} disabled={disabled} onChange={(e) => set({ primary: e.target.value })} />
          )}
          {pc.mode === "gradient" && (
            <Input label="Accent color" type="color" value={pc.accent} disabled={disabled} onChange={(e) => set({ accent: e.target.value })} />
          )}
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Presets</p>
          <div className="flex flex-wrap gap-2">
            {PROFILE_PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                title={preset.name}
                aria-label={`Use the ${preset.name} preset`}
                disabled={disabled}
                onClick={() => set({ mode: pc.mode === "off" ? "gradient" : pc.mode, primary: preset.primary, accent: preset.accent })}
                className="size-9 rounded-full border border-line-strong transition-transform hover:scale-110 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ background: `linear-gradient(135deg, ${preset.primary}, ${preset.accent})` }}
              />
            ))}
          </div>
        </div>

        {look ? (
          <div className="overflow-hidden rounded-card border" style={look.style} aria-label="Profile card preview">
            <div className="h-14" style={{ background: "rgb(0 0 0 / .12)" }} />
            <div className="px-4 pb-4">
              <div className="-mt-7 size-14 rounded-full border-4" style={{ background: "var(--color-raised)", borderColor: "var(--color-surface)" }} />
              <p className="mt-2 text-base font-semibold text-ink">Your name</p>
              <p className="text-xs text-muted">@handle</p>
              <p className="mt-2 text-sm text-ink">A short line about you appears here.</p>
              <p className="mt-1 text-xs text-muted">Secondary text looks like this.</p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted">Choose Solid color or Gradient to see a preview.</p>
        )}
      </CardBody>
    </Card>
  );
}