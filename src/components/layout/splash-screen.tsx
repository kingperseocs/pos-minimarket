"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// Shown right after logging in, while the role's screen loads:
//   1. A soft orange screen with a vending machine in the middle.
//   2. The machine fills with water from the bottom up, following the real
//      load: it rises fast, slows down near 85 % while the screen is still
//      loading, and tops up once the caja / almacén / panel is ready (never
//      before MIN_VISIBLE_MS, so the fill is always seen).
//   3. Full: the orange breaks into little squares that vanish from the top
//      down, uncovering the screen underneath.
// It lives in the root layout so it survives the navigation away from
// /login and dissolves over the new screen instead of cutting to it.

const STORAGE_KEY = "navexpress:splash";
const START_EVENT = "navexpress:splash";
const MIN_VISIBLE_MS = 1500;
const STALE_MS = 15_000;
// While loading the water stops short of the top; it fills only when ready.
const LOADING_CEILING = 0.85;
// Dissolve: rows go from top to bottom over SWEEP_MS, each square with a bit
// of jitter, and each square fades in CELL_MS (see .vend-cell in globals.css).
const SWEEP_MS = 700;
const JITTER_MS = 260;
const CELL_MS = 380;
const CELL_PX = 30;

type Phase = "hidden" | "filling" | "leaving";

export function startSplash() {
  try {
    sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // Private mode: the event below still shows it.
  }
  window.dispatchEvent(new Event(START_EVENT));
}

function readStart() {
  try {
    const value = Number(sessionStorage.getItem(STORAGE_KEY));
    // A leftover from a splash that never finished: ignore it.
    const fresh = Number.isFinite(value) && value > 0 && Date.now() - value < STALE_MS;
    return fresh ? value : null;
  } catch {
    return null;
  }
}

function clearStart() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {}
}

// A stable pseudo-random number in [0, 1) for each square (no Math.random
// during render: the pattern is the same on every frame).
function noise(i: number) {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// The orange, as squares, so it can break apart from the top down.
function DissolveGrid() {
  const cols = Math.ceil(window.innerWidth / CELL_PX);
  const rows = Math.ceil(window.innerHeight / CELL_PX);
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const delay = (r / Math.max(rows - 1, 1)) * SWEEP_MS + noise(i) * JITTER_MS;
      cells.push(
        <span
          key={i}
          className="vend-cell"
          style={{
            left: c * CELL_PX,
            top: r * CELL_PX,
            // +1 px so neighbouring squares never show a seam.
            width: CELL_PX + 1,
            height: CELL_PX + 1,
            animationDelay: `${Math.round(delay)}ms`,
          }}
        />,
      );
    }
  }
  return (
    <div aria-hidden className="absolute inset-0">
      {cells}
    </div>
  );
}

// Window of the machine, in the SVG's units.
const WIN = { x: 22, y: 26, w: 116, h: 196 };

function VendingMachine({ level }: { level: number }) {
  // Water surface: from the bottom of the window (0) to its top (1).
  const surface = WIN.y + WIN.h * (1 - level);
  const shelves = [74, 122, 170];
  return (
    <svg
      viewBox="0 0 200 300"
      className="h-auto w-56 drop-shadow-[0_18px_24px_rgba(124,45,18,0.35)] sm:w-64"
      aria-hidden
    >
      <defs>
        <clipPath id="vend-window">
          <rect x={WIN.x} y={WIN.y} width={WIN.w} height={WIN.h} rx="6" />
        </clipPath>
        <linearGradient id="vend-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7DD3FC" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#0284C7" stopOpacity="0.92" />
        </linearGradient>
        <linearGradient id="vend-glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
          <stop offset="45%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Legs and body. */}
      <rect x="22" y="282" width="14" height="12" rx="3" fill="#1F2937" />
      <rect x="164" y="282" width="14" height="12" rx="3" fill="#1F2937" />
      <rect x="8" y="8" width="184" height="278" rx="14" fill="#E53935" />
      <rect x="8" y="8" width="184" height="278" rx="14" fill="none" stroke="#B71C1C" strokeWidth="3" />

      {/* Window: dark glass, shelves and faint product silhouettes. */}
      <rect x={WIN.x} y={WIN.y} width={WIN.w} height={WIN.h} rx="6" fill="#1E293B" />
      <g clipPath="url(#vend-window)">
        {[34, 82, 130, 178].map((top) =>
          [34, 62, 90, 118].map((left) => (
            <rect key={`${top}-${left}`} x={left} y={top} width="16" height="34" rx="5" fill="#ffffff" opacity="0.1" />
          )),
        )}
        {shelves.map((y) => (
          <rect key={y} x={WIN.x} y={y} width={WIN.w} height="3" fill="#ffffff" opacity="0.18" />
        ))}

        {/* The water: two waves (back and front) on a rising surface. */}
        <g className="vend-water-level" style={{ transform: `translateY(${surface}px)` }}>
          <path
            className="vend-wave-back"
            d="M0 6 Q15 0 30 6 T60 6 T90 6 T120 6 T150 6 T180 6 T210 6 T240 6 T270 6 T300 6 V240 H0 Z"
            fill="#38BDF8"
            opacity="0.55"
          />
          <path
            className="vend-wave"
            d="M0 9 Q15 2 30 9 T60 9 T90 9 T120 9 T150 9 T180 9 T210 9 T240 9 T270 9 T300 9 V240 H0 Z"
            fill="url(#vend-water)"
          />
          {[30, 55, 78, 101, 124].map((x, i) => (
            <circle
              key={x}
              className="vend-bubble"
              cx={x}
              cy="60"
              r={1.6 + (i % 3)}
              fill="#E0F2FE"
              style={{ animationDelay: `${i * 0.45}s`, animationDuration: `${2 + (i % 3) * 0.6}s` }}
            />
          ))}
        </g>
        <rect x={WIN.x} y={WIN.y} width={WIN.w} height={WIN.h} fill="url(#vend-glass)" />
      </g>
      <rect x={WIN.x} y={WIN.y} width={WIN.w} height={WIN.h} rx="6" fill="none" stroke="#111827" strokeWidth="3" />

      {/* Side panel: screen, buttons, coin slot. */}
      <rect x="148" y="26" width="34" height="196" rx="5" fill="#C62828" />
      <rect x="153" y="34" width="24" height="30" rx="3" fill="#0EA5E9" />
      <rect x="156" y="38" width="18" height="4" rx="2" fill="#E0F2FE" opacity="0.8" />
      {[72, 82, 92].map((y) =>
        [155, 165].map((x) => <rect key={`${x}-${y}`} x={x} y={y} width="8" height="6" rx="1.5" fill="#1F2937" />),
      )}
      <rect x="156" y="108" width="18" height="10" rx="2" fill="#1F2937" />
      <rect x="161" y="112" width="8" height="2" rx="1" fill="#9CA3AF" />

      {/* Delivery slot. */}
      <rect x="40" y="236" width="98" height="26" rx="4" fill="#111827" />
      <text x="89" y="253" textAnchor="middle" fontSize="10" fontWeight="700" fill="#F9FAFB" letterSpacing="2">
        PUSH
      </text>
    </svg>
  );
}

export function SplashScreen() {
  const pathname = usePathname();
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>("hidden");
  const [level, setLevel] = useState(0);
  const levelRef = useRef(0);

  // Started by the login form (or still running after a reload mid-splash).
  useEffect(() => {
    const begin = () => {
      levelRef.current = 0;
      setLevel(0);
      setStartedAt(readStart() ?? Date.now());
      setPhase("filling");
    };
    if (readStart()) begin();
    window.addEventListener(START_EVENT, begin);
    return () => window.removeEventListener(START_EVENT, begin);
  }, []);

  // Ready once we are off the login page (the role's screen is rendering).
  const ready = pathname !== "/login";

  // The fill, frame by frame: towards 85 % while loading, then to the top.
  useEffect(() => {
    if (phase !== "filling" || startedAt === null) return;
    let frame = 0;
    let full: ReturnType<typeof setTimeout> | null = null;
    const tick = () => {
      const canFinish = ready && Date.now() - startedAt >= MIN_VISIBLE_MS;
      const target = canFinish ? 1 : LOADING_CEILING;
      const current = levelRef.current;
      // Ease towards the target, with a small constant push so it never crawls.
      const next = Math.min(target, current + (target - current) * (canFinish ? 0.12 : 0.035) + 0.0015);
      levelRef.current = next;
      setLevel(next);
      if (next >= 0.999) {
        // Let the full machine be seen for a moment, then dissolve.
        full = setTimeout(() => setPhase("leaving"), 250);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      if (full) clearTimeout(full);
    };
  }, [phase, startedAt, ready]);

  useEffect(() => {
    if (phase !== "leaving") return;
    const done = setTimeout(() => {
      clearStart();
      setPhase("hidden");
      setStartedAt(null);
    }, SWEEP_MS + JITTER_MS + CELL_MS + 50);
    return () => clearTimeout(done);
  }, [phase]);

  if (phase === "hidden") return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Cargando"
      data-leaving={phase === "leaving" || undefined}
      className="vend-root fixed inset-0 z-100 overflow-hidden"
    >
      <DissolveGrid />
      <div className="vend-machine absolute inset-0 flex items-center justify-center px-6">
        <VendingMachine level={level} />
      </div>
    </div>
  );
}
