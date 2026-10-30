import { Card } from "../shared/ui";
import type { NavItem } from "./nav";

export default function EmptyScreen({ item }: { item: NavItem }) {
  return (
    <div className="rise">
      <h1 className="text-xl font-medium">{item.label}</h1>
      <p className="mt-1 text-sm text-muted">{item.blurb}</p>
      <Card className="mt-6 px-6 py-12 text-center">
        <p className="text-sm text-ink">Nothing to manage here yet.</p>
        <p className="mt-1 text-sm text-muted">This screen is built in Part {item.part}.</p>
      </Card>
    </div>
  );
}
