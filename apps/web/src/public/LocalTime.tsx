import { useEffect, useState } from "react";

function fmt(tz: string): string | null {
  try { return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", timeZone: tz }).format(new Date()); } catch { return null; }
}

export default function LocalTime({ timezone }: { timezone: string }) {
  const [t, setT] = useState(() => fmt(timezone));
  useEffect(() => { const id = window.setInterval(() => setT(fmt(timezone)), 20000); setT(fmt(timezone)); return () => window.clearInterval(id); }, [timezone]);
  if (!t) return null;
  return <span>{t} local time</span>;
}
