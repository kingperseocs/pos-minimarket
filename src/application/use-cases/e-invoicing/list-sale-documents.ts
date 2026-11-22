import type { SaleDocumentFilters } from "@/domain/entities/sale-document";
import type { SaleDocumentRepository } from "@/domain/repositories/sale-document-repository";

export function listSaleDocumentsUseCase(
  repo: Pick<SaleDocumentRepository, "list">,
  filters: SaleDocumentFilters,
) {
  return repo.list(filters);
}
