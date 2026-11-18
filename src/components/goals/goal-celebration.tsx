"use client";

import { useEffect, useState } from "react";

const COLORS = ["#f97316", "#fb923c", "#facc15", "#22c55e", "#3b82f6", "#ec4899"];
const PIECES = 36;

// Confetti once per month and browser when the goal is reached. Remembered
// in localStorage only as a courtesy: if storage fails it may show again.
export function GoalCelebration({ month, reached }: { month: string; reached: boolean }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!reached) return;
    const key = `goal-celebrated-${month}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      // Private mode or blocked storage: celebrate anyway.
    }
    // A one-off effect right after mount is the point here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShow(true);
    const timer = setTimeout(() => setShow(false), 4500);
    return () => clearTimeout(timer);
  }, [month, reached]);

  if (!show) return null;
  return (
    <div className="goal-confetti" aria-hidden>
      {Array.from({ length: PIECES }, (_, i) => (
        <span
          key={i}
          style={
            {
              left: `${(i * 97) % 100}%`,
              background: COLORS[i % COLORS.length],
              "--delay": `${(i % 9) * 0.12}s`,
              "--fall": `${2.2 + (i % 5) * 0.3}s`,
              "--drift": `${((i * 37) % 120) - 60}px`,
              "--spin": `${360 + (i % 4) * 180}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
