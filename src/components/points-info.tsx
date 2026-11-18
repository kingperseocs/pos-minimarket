"use client";

import { InfoPopover } from "@/components/admin/price-info";
import { PopoverDescription } from "@/components/ui/popover";

export type PointsRules = {
  pointsPerSol: number;
  // 0 = points can't be redeemed.
  redeemPointsPerSol: number;
  minRedeemPoints: number;
};

// "i" next to a points balance: how points are earned and spent, in plain
// words, from the rules in force.
export function PointsInfo({
  rules,
  side = "bottom",
  align = "start",
}: {
  rules: PointsRules;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
}) {
  const { pointsPerSol, redeemPointsPerSol, minRedeemPoints } = rules;

  return (
    <InfoPopover label="Cómo funcionan los puntos" title="¿Cómo funcionan los puntos?" side={side} align={align}>
      <PopoverDescription className="flex flex-col gap-2 text-xs">
        <span>
          Ganas <strong>{pointsPerSol}</strong> punto{pointsPerSol === 1 ? "" : "s"} por
          cada <strong>S/ 1</strong> que pagas en tus compras.
        </span>
        {redeemPointsPerSol > 0 ? (
          <>
            <span>
              Cada <strong>{redeemPointsPerSol} puntos</strong> valen{" "}
              <strong>S/ 1</strong> de descuento. Pide en caja usar tus puntos.
            </span>
            <span className="rounded-md bg-muted/60 p-2 font-mono">
              {redeemPointsPerSol * 5} pts → S/ 5.00 menos
            </span>
            {minRedeemPoints > 0 && (
              <span>
                Necesitas al menos <strong>{minRedeemPoints} puntos</strong> para
                canjear.
              </span>
            )}
            <span>
              Para canjear, la caja te pedirá tu fecha de nacimiento.
            </span>
          </>
        ) : (
          <span>Por ahora los puntos solo se acumulan; aún no se pueden canjear.</span>
        )}
        <span>
          Si ves una compra o un canje que no hiciste, avisa al encargado.
        </span>
      </PopoverDescription>
    </InfoPopover>
  );
}
