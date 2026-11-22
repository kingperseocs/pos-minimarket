"use client";

import { LoaderCircleIcon, SendIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { retryPendingDocuments } from "@/actions/e-invoicing";
import { Button } from "@/components/ui/button";

// Sends the queued and failed documents whose turn has come, now.
export function RetryPendingButton({ pending }: { pending: number }) {
  const [isPending, startTransition] = useTransition();
  if (pending === 0) return null;
  return (
    <Button
      variant="outline"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await retryPendingDocuments();
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          const { issued, retry, rejected } = result.data;
          toast.success(
            issued + retry + rejected === 0
              ? "Ninguno tocaba todavía: se reintentan solos cada pocos minutos."
              : `Emitidos: ${issued} · por reintentar: ${retry} · con error: ${rejected}`,
          );
        })
      }
    >
      {isPending ? <LoaderCircleIcon className="animate-spin" /> : <SendIcon data-icon="inline-start" />}
      Reintentar pendientes ({pending})
    </Button>
  );
}
