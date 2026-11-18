import { cn } from "@/lib/utils";

const CHECKS = [0, 1, 2, 3, 4, 5, 6];

// A checkered post of the finish arch.
function Post({ x }: { x: number }) {
  return (
    <g>
      <rect x={x} y="9" width="4" height="35" rx="1" fill="#fff" stroke="#1c1917" strokeWidth="0.8" />
      {CHECKS.map((i) => (
        <rect key={i} x={x + (i % 2 ? 2 : 0)} y={9 + i * 5} width="2" height="5" fill="#1c1917" />
      ))}
    </g>
  );
}

// The finish line at the end of the bar: an arch with a "META" banner and
// the finish tape across. When the goal is reached, the tape snaps.
export function FinishLine({
  reached,
  className,
}: {
  reached: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 48 44"
      className={cn("goal-finish shrink-0 overflow-visible", reached && "goal-finish-reached", className)}
      role="img"
      aria-label={reached ? "¡Meta cumplida!" : "Meta del mes"}
    >
      <title>{reached ? "¡Meta cumplida!" : "Meta del mes"}</title>
      <Post x={2} />
      <Post x={42} />
      {/* Banner. */}
      <rect x="0" y="0.5" width="48" height="13" rx="2.5" fill="#ea580c" stroke="#9a3412" strokeWidth="0.8" />
      <rect x="1.5" y="2" width="45" height="10" rx="1.8" fill="none" stroke="#fed7aa" strokeWidth="0.6" strokeDasharray="2 1.5" />
      <text
        x="24"
        y="10.6"
        textAnchor="middle"
        fontSize="9"
        fontWeight="800"
        letterSpacing="1"
        fill="#fff"
        fontFamily="system-ui, sans-serif"
      >
        META
      </text>
      {/* Finish tape: whole until reached, then two loose ends. */}
      {reached ? (
        <g className="goal-tape-broken" stroke="#dc2626" strokeWidth="2.4" strokeLinecap="round" fill="none">
          <path d="M6 27 Q10 33 12 40" />
          <path d="M42 27 Q38 33 36 40" />
        </g>
      ) : (
        <g className="goal-tape">
          <path d="M6 27 Q24 30.5 42 27" stroke="#dc2626" strokeWidth="2.6" fill="none" />
          <path d="M6 27 Q24 30.5 42 27" stroke="#fff" strokeWidth="0.7" strokeDasharray="3 3" fill="none" />
        </g>
      )}
    </svg>
  );
}
