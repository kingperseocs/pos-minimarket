import { Badge } from "@/components/ui/badge";
import { SALE_DOCUMENT_STATUS_LABELS, type SaleDocumentStatus } from "@/domain/entities/sale-document";

const TONES: Record<SaleDocumentStatus, string> = {
  issued: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  queued: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  sending: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  review: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  failed: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
  voided: "text-muted-foreground line-through",
};

// The POS-side state of a document; for an issued one, SUNAT's verdict when
// it is not a plain acceptance (PENDIENTE, OBSERVADO, RECHAZADO…).
export function DocumentStatusBadge({
  status,
  motorStatus,
}: {
  status: SaleDocumentStatus;
  motorStatus?: string | null;
}) {
  const label =
    status === "issued" && motorStatus && motorStatus !== "ACEPTADO"
      ? `${SALE_DOCUMENT_STATUS_LABELS.issued} · ${motorStatus.toLowerCase()}`
      : SALE_DOCUMENT_STATUS_LABELS[status];
  return (
    <Badge variant="outline" className={TONES[status]}>
      {label}
    </Badge>
  );
}
