import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NameText from "./public/fx/NameText";
import EnterScreen from "./public/fx/EnterScreen";
import BackgroundFx from "./public/fx/BackgroundFx";
import TiltCard from "./public/fx/TiltCard";
import FxCard from "./admin/FxCard";
import { DEFAULT_FX, NOIZ_FX } from "./shared/fx";
import type { ThemeTokens } from "./shared/theme";

beforeEach(() => {
  document.documentElement.dataset.motion = "on";
  sessionStorage.clear();
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("name effects", () => {
  it("decrypt starts scrambled, keeps the real name for screen readers, and settles on the real text", () => {
    vi.useFakeTimers();
    render(<NameText text="Ali Mohamed" effect="decrypt" />);
    expect(screen.getByText("Ali Mohamed", { selector: ".sr-only" })).toBeInTheDocument();
    const visible = document.querySelector("[aria-hidden]")!;
    expect(visible.textContent).not.toBe("Ali Mohamed");
    act(() => { vi.advanceTimersByTime(1200); });
    expect(visible.textContent).toBe("Ali Mohamed");
  });
  it("shows the plain name when motion is off", () => {
    document.documentElement.dataset.motion = "off";
    render(<NameText text="Ali" effect="decrypt" />);
    expect(document.querySelector("[aria-hidden]")!.textContent).toBe("Ali");
  });
  it("glitch keeps the real text and exposes it to the style layer", () => {
    render(<NameText text="Ali" effect="glitch" />);
    const el = screen.getByText("Ali");
    expect(el).toHaveAttribute("data-text", "Ali");
  });
});

describe("enter screen", () => {
  it("opens once, remembers the visit, and releases the page", () => {
    vi.useFakeTimers();
    const { unmount } = render(<EnterScreen text="Click to enter" />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.click(screen.getByRole("button", { name: "Click to enter" }));
    act(() => { vi.advanceTimersByTime(400); });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).not.toBe("hidden");
    unmount();
    render(<EnterScreen text="Click to enter" />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("background and tilt", () => {
  it("renders a decorative canvas without crashing when canvas is unavailable", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    render(<BackgroundFx kind="aurora" colors={["#5b4bdb", "#b44cd6"]} />);
    const canvas = screen.getByTestId("background-fx");
    expect(canvas).toHaveAttribute("aria-hidden", "true");
  });
  it("tilt leaves content untouched on touch-only devices", () => {
    render(<TiltCard enabled><p>Card</p></TiltCard>);
    expect(screen.getByText("Card").parentElement).toBe(document.body.firstElementChild);
  });
});

describe("admin effects card", () => {
  const base = { animation: { enabled: false, intensity: "balanced", duration: 180, hoverEffects: false, pageTransitions: false }, cards: { background: "#13111b", border: "#2a2638", radius: 14, shadow: "soft", blur: 10 } } as unknown as ThemeTokens;

  it("applies the Noiz look and turns animations on", () => {
    const onChange = vi.fn();
    render(<FxCard tokens={base} disabled={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Apply Noiz look" }));
    const next = onChange.mock.calls[0]![0] as ThemeTokens;
    expect(next.fx).toEqual(NOIZ_FX);
    expect(next.animation.enabled).toBe(true);
    expect(next.cards.radius).toBeGreaterThanOrEqual(18);
  });
  it("changes one setting and keeps the rest", () => {
    const onChange = vi.fn();
    render(<FxCard tokens={{ ...base, fx: { ...DEFAULT_FX, glow: "soft" } }} disabled={false} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Animated background"), { target: { value: "stars" } });
    expect((onChange.mock.calls[0]![0] as ThemeTokens).fx).toEqual({ ...DEFAULT_FX, glow: "soft", background: "stars" });
  });
  it("is read-only when the theme cannot be edited", () => {
    render(<FxCard tokens={base} disabled onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Apply Noiz look" })).toBeDisabled();
    expect(screen.getByLabelText("Animated background")).toBeDisabled();
  });
  it("explains why a still background shows when animations are off", () => {
    render(<FxCard tokens={base} disabled={false} onChange={() => {}} />);
    expect(screen.getByText(/Animations are turned off/)).toBeInTheDocument();
  });
});