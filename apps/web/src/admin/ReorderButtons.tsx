import { Button } from "../shared/ui";

/** Keyboard- and touch-friendly reordering (no drag and drop needed). */
export default function ReorderButtons({ index, count, name, onMove }: { index: number; count: number; name: string; onMove: (from: number, to: number) => void }) {
  return (
    <div className="flex gap-1">
      <Button variant="ghost" size="sm" aria-label={`Move ${name} up`} disabled={index === 0} onClick={() => onMove(index, index - 1)}>↑</Button>
      <Button variant="ghost" size="sm" aria-label={`Move ${name} down`} disabled={index === count - 1} onClick={() => onMove(index, index + 1)}>↓</Button>
    </div>
  );
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = list.slice();
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x);
  return next;
}
