import { useEffect, useState } from "react";
import { canAnimate } from "./motion";

const GLYPHS = "!<>-_/[]{}=+*^?#%&";

function scramble(text: string, reveal: number): string {
  return text.split("").map((ch, i) => (ch === " " || i < reveal ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]!)).join("");
}

/** Display name with an optional effect. Screen readers always get the real name. */
export default function NameText({ text, effect }: { text: string; effect: "none" | "glitch" | "decrypt" }) {
  const decrypt = effect === "decrypt" && canAnimate();
  const [shown, setShown] = useState(() => (decrypt ? scramble(text, 0) : text));

  useEffect(() => {
    if (!decrypt) { setShown(text); return; }
    const total = 26;
    let frame = 0;
    const id = window.setInterval(() => {
      frame += 1;
      if (frame >= total) { window.clearInterval(id); setShown(text); return; }
      setShown(scramble(text, Math.floor((frame / total) * text.length)));
    }, 32);
    return () => window.clearInterval(id);
  }, [text, decrypt]);

  if (effect === "glitch") return <span className="fx-glitch" data-text={text}>{text}</span>;
  if (effect === "decrypt") return <><span className="sr-only">{text}</span><span aria-hidden>{shown}</span></>;
  return <>{text}</>;
}