import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  CalendarDaysIcon,
  ClockIcon,
  CoinsIcon,
  EqualIcon,
  type LucideIcon,
  PlaneIcon,
  StarIcon,
  TagsIcon,
  WalletIcon,
} from "lucide-react";
import type { Insight, InsightIcon, InsightTone } from "@/domain/services/sales-insights";
import { cn } from "@/lib/utils";

const ICONS: Record<InsightIcon, LucideIcon> = {
  "trend-up": ArrowUpRightIcon,
  "trend-down": ArrowDownRightIcon,
  steady: EqualIcon,
  calendar: CalendarDaysIcon,
  clock: ClockIcon,
  star: StarIcon,
  category: TagsIcon,
  plane: PlaneIcon,
  coins: CoinsIcon,
  wallet: WalletIcon,
};

// Good/bad always come with an icon and words, never color alone.
const TONE_STYLES: Record<InsightTone, string> = {
  good: "bg-(--viz-good-bg) text-(--viz-good)",
  bad: "bg-(--viz-bad-bg) text-(--viz-bad)",
  neutral: "bg-primary/10 text-primary",
};

export function InsightIconBadge({
  insight,
  className,
}: {
  insight: Pick<Insight, "icon" | "tone">;
  className?: string;
}) {
  const Icon = ICONS[insight.icon];
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full",
        TONE_STYLES[insight.tone],
        className,
      )}
    >
      <Icon className="size-4.5" aria-hidden />
    </span>
  );
}

// "Lo que dicen tus números": each finding as one short sentence and a
// detail line. This is the part the admin actually reads.
export function InsightList({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h3 className="font-heading text-base font-semibold">Lo que dicen tus números</h3>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {insights.map((insight) => (
          <li key={insight.title} className="flex gap-3 rounded-xl border bg-card p-4 shadow-xs">
            <InsightIconBadge insight={insight} />
            <div className="min-w-0 space-y-0.5">
              <p className="font-medium leading-snug">{insight.title}</p>
              <p className="text-sm text-muted-foreground">{insight.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
