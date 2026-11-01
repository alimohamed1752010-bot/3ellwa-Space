import { usePublicSite } from "../useSite";
import BackgroundFx from "./BackgroundFx";
import CursorGlow from "./CursorGlow";
import EnterScreen from "./EnterScreen";

/** Page-wide effects chosen in the theme: animated background, cursor glow and the enter screen. */
export default function SiteFx() {
  const site = usePublicSite();
  const t = site.data?.theme?.tokens;
  const fx = t?.fx;
  if (!t || !fx) return null;
  const p = t.profile;
  const colors = p && p.mode !== "off"
    ? (p.mode === "solid" ? [p.primary, p.primary] : [p.primary, p.accent])
    : [t.colors.accent, t.colors.accentSoft];
  return (
    <>
      {fx.background !== "none" && <BackgroundFx key={fx.background} kind={fx.background} colors={colors} />}
      {fx.cursorGlow && <CursorGlow color={colors[1]!} />}
      {fx.enterScreen.enabled && <EnterScreen text={fx.enterScreen.text} />}
    </>
  );
}