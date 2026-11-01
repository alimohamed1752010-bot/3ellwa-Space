import { Button, Card, CardBody, CardHeader, Checkbox, Input, Select } from "../shared/ui";
import { DEFAULT_FX, NOIZ_FX, type FxTokens } from "../shared/fx";
import type { ThemeTokens } from "../shared/theme";

interface Props {
  tokens: ThemeTokens;
  disabled: boolean;
  onChange: (next: ThemeTokens) => void;
}

export default function FxCard({ tokens, disabled, onChange }: Props) {
  const fx: FxTokens = tokens.fx ?? DEFAULT_FX;
  const set = (patch: Partial<FxTokens>) => onChange({ ...tokens, fx: { ...fx, ...patch } });

  const applyNoizLook = () =>
    onChange({
      ...tokens,
      fx: NOIZ_FX,
      animation: { ...tokens.animation, enabled: true, hoverEffects: true, pageTransitions: true },
      cards: { ...tokens.cards, radius: Math.max(tokens.cards.radius, 18), blur: Math.max(tokens.cards.blur, 16), shadow: "strong" },
    });

  return (
    <Card>
      <CardHeader
        title="Effects"
        description="Animated background, glow, card tilt and more. They appear on the public site after you publish, and switch off on their own for visitors who prefer reduced motion."
        action={
          <Button size="sm" variant="secondary" disabled={disabled} onClick={applyNoizLook}>
            Apply Noiz look
          </Button>
        }
      />
      <CardBody className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Select label="Animated background" value={fx.background} disabled={disabled} onChange={(e) => set({ background: e.target.value as FxTokens["background"] })}>
            <option value="none">None</option>
            <option value="aurora">Aurora</option>
            <option value="stars">Starfield</option>
          </Select>
          <Select label="Card glow" value={fx.glow} disabled={disabled} onChange={(e) => set({ glow: e.target.value as FxTokens["glow"] })}>
            <option value="none">None</option>
            <option value="soft">Soft</option>
            <option value="pulse">Pulse</option>
          </Select>
          <Select label="Avatar shape" value={fx.avatarShape} disabled={disabled} onChange={(e) => set({ avatarShape: e.target.value as FxTokens["avatarShape"] })}>
            <option value="circle">Circle</option>
            <option value="rounded">Rounded square</option>
            <option value="square">Square</option>
          </Select>
          <Select label="Name effect" value={fx.nameEffect} disabled={disabled} onChange={(e) => set({ nameEffect: e.target.value as FxTokens["nameEffect"] })}>
            <option value="none">None</option>
            <option value="decrypt">Decrypt on load</option>
            <option value="glitch">Glitch</option>
          </Select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Checkbox label="Tilt the profile card on hover" hint="Desktop mouse only" checked={fx.tilt} disabled={disabled} onChange={(e) => set({ tilt: e.target.checked })} />
          <Checkbox label="Cursor glow" hint="A soft light that follows the mouse" checked={fx.cursorGlow} disabled={disabled} onChange={(e) => set({ cursorGlow: e.target.checked })} />
          <Checkbox label="Avatar glow" checked={fx.avatarGlow} disabled={disabled} onChange={(e) => set({ avatarGlow: e.target.checked })} />
          <Checkbox label="Enter screen" hint="Visitors click once to open the site" checked={fx.enterScreen.enabled} disabled={disabled} onChange={(e) => set({ enterScreen: { ...fx.enterScreen, enabled: e.target.checked } })} />
        </div>
        {fx.enterScreen.enabled && (
          <Input
            label="Enter screen text"
            maxLength={40}
            value={fx.enterScreen.text}
            disabled={disabled}
            onChange={(e) => set({ enterScreen: { ...fx.enterScreen, text: e.target.value } })}
          />
        )}
        {!tokens.animation.enabled && (
          <p className="text-xs text-muted">Animations are turned off in this theme, so the background shows as a still image and motion effects are skipped.</p>
        )}
      </CardBody>
    </Card>
  );
}