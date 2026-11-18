import type { GoalMood } from "@/domain/entities/sales-goal";
import { cn } from "@/lib/utils";

const FUR = "#ffffff";
const FUR_SHADE = "#f4f2ef";
const OUTLINE = "#b9b1a7";
const EAR = "#f1e4cf";
const EAR_OUTLINE = "#d8c6a8";
const DARK = "#1c1917";

// The goal's mascot: a white Shih Tzu (long hair to the floor, plumed tail,
// top-knot with an orange bow) that runs toward the finish line. Drawn inline
// (no image request, works offline) with a soft outline so it reads on white,
// and animated by CSS keyframes in globals.css keyed by data-mood.
export function DogMascot({
  mood,
  className,
  title,
}: {
  mood: GoalMood;
  className?: string;
  title?: string;
}) {
  const sleeping = mood === "sleeping";
  const tongue = mood === "excited" || mood === "celebrating";

  return (
    <svg
      viewBox="0 0 64 48"
      data-mood={mood}
      className={cn("goal-dog overflow-visible", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title && <title>{title}</title>}
      <g className="dog-zzz" fill="currentColor">
        <text x="52" y="2" fontSize="7" fontWeight="700">z</text>
        <text x="58" y="-4" fontSize="5" fontWeight="700">z</text>
      </g>
      <g className="dog-body">
        {/* Plumed tail curled over the back. */}
        <g className="dog-tail">
          <path
            d="M18 21 C11 19 9 11 14 7.5 C17.5 5.5 21.5 8.5 19.5 12.5"
            fill="none"
            stroke={OUTLINE}
            strokeWidth="7.5"
            strokeLinecap="round"
          />
          <path
            d="M18 21 C11 19 9 11 14 7.5 C17.5 5.5 21.5 8.5 19.5 12.5"
            fill="none"
            stroke={FUR}
            strokeWidth="5.8"
            strokeLinecap="round"
          />
        </g>
        {/* Short legs: only the fluffy paws peek out under the coat. */}
        <rect className="dog-leg dog-leg-b2" x="23" y="34" width="5" height="10" rx="2.5" fill={FUR_SHADE} stroke={OUTLINE} strokeWidth="0.8" />
        <rect className="dog-leg dog-leg-f2" x="41" y="34" width="5" height="10" rx="2.5" fill={FUR_SHADE} stroke={OUTLINE} strokeWidth="0.8" />
        <rect className="dog-leg dog-leg-b1" x="17" y="34" width="5.5" height="10" rx="2.75" fill={FUR} stroke={OUTLINE} strokeWidth="0.8" />
        <rect className="dog-leg dog-leg-f1" x="35" y="34" width="5.5" height="10" rx="2.75" fill={FUR} stroke={OUTLINE} strokeWidth="0.8" />
        {/* Long silky coat down to the floor, with a wavy hem. */}
        <path
          d="M14 27 C13.5 19 21 15.5 31 15.5 C39.5 15.5 46 17.5 47.5 24 L48 37 Q46 40.5 44 37.5 Q42 40.5 40 37.5 Q38 40.5 36 37.5 Q34 40.5 32 37.5 Q30 40.5 28 37.5 Q26 40.5 24 37.5 Q22 40.5 20 37.5 Q17.5 40.5 15.5 37 Z"
          fill={FUR}
          stroke={OUTLINE}
          strokeWidth="1"
          strokeLinejoin="round"
        />
        <g fill="none" stroke={OUTLINE} strokeWidth="0.7" strokeLinecap="round" opacity="0.7">
          <path d="M21 22 Q22.5 28 21 35" />
          <path d="M27 21 Q28.5 28 27 36" />
          <path d="M33 21 Q34.5 28 33 36" />
          <path d="M39 22 Q40.5 28 39 35" />
        </g>
        {/* Orange collar: the store's color. */}
        <path d="M41.5 21 Q44 27 42.5 31" fill="none" stroke="#f97316" strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="43" cy="31.5" r="1.5" fill="#facc15" />
        <g className="dog-head">
          <circle cx="49" cy="16" r="10.5" fill={FUR} stroke={OUTLINE} strokeWidth="1" />
          {/* Top-knot with a bow. */}
          <path d="M45 7.5 Q47 2 50 3.5 Q53 2 53.5 7" fill={FUR} stroke={OUTLINE} strokeWidth="0.9" />
          <g className="dog-bow">
            <path d="M46 2.5 L49.5 4.5 L46 6.8 Z" fill="#f97316" stroke="#c2410c" strokeWidth="0.5" strokeLinejoin="round" />
            <path d="M53 2.5 L49.5 4.5 L53 6.8 Z" fill="#f97316" stroke="#c2410c" strokeWidth="0.5" strokeLinejoin="round" />
            <circle cx="49.5" cy="4.6" r="1.1" fill="#ea580c" />
          </g>
          {/* Moustache and beard: the flat, fluffy Shih Tzu face. */}
          <path
            d="M50.5 19 C51 15.5 56 14 59.5 16 C62.5 18 62 22.5 59.5 24.5 C58.5 28.5 54 29.5 52 26.5 C50 25 50 21.5 50.5 19 Z"
            fill={FUR}
            stroke={OUTLINE}
            strokeWidth="0.9"
          />
          <ellipse cx="58.8" cy="18" rx="1.9" ry="1.5" fill={DARK} />
          <path d="M56 21.8 Q57.5 22.8 59 21.8" fill="none" stroke={DARK} strokeWidth="0.8" strokeLinecap="round" />
          {tongue && (
            <ellipse className="dog-tongue" cx="57.6" cy="24.2" rx="1.5" ry="2.3" fill="#f472b6" />
          )}
          {sleeping ? (
            <path d="M51.5 13 Q53.5 15 55.5 13" fill="none" stroke={DARK} strokeWidth="1.2" strokeLinecap="round" />
          ) : (
            <>
              <circle cx="53.6" cy="12.8" r="2.1" fill={DARK} />
              <circle cx="54.3" cy="12.1" r="0.7" fill="#fff" />
            </>
          )}
          <ellipse cx="50.5" cy="19" rx="1.6" ry="1" fill="#fbb6b6" opacity="0.55" />
          {/* Long, silky drop ear. */}
          <g className="dog-ear">
            <path
              d="M43.6 9 C40.8 10 40.2 15.5 40.6 20.5 C41 25.5 42.2 28.3 43.8 27.7 C45.4 28 45.9 25 45.7 20.5 C45.8 15.5 45.8 10.3 43.6 9 Z"
              fill={EAR}
              stroke={EAR_OUTLINE}
              strokeWidth="0.9"
            />
            <path d="M43 14 Q42.6 20.5 43.4 25.5"fill="none" stroke={EAR_OUTLINE} strokeWidth="0.6" strokeLinecap="round" />
          </g>
        </g>
      </g>
    </svg>
  );
}
