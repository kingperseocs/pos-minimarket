import { REVIEW_REASON_LABELS, type ReviewReason } from "@/domain/entities/sale-document";

export function reviewText(reasons: ReviewReason[]) {
  return reasons.map((r) => REVIEW_REASON_LABELS[r]).join(", ");
}
