import type { SaleDocumentNote, SaleDocumentNoteKind } from "../entities/sale-document";

export interface NewSaleDocumentNote {
  saleDocumentId: number;
  kind: SaleDocumentNoteKind;
  motorId: string;
  number: string;
  reasonCode: string | null;
  reasonText: string;
  motorStatus: string;
  createdBy: number;
}

export interface SaleDocumentNoteRepository {
  create(note: NewSaleDocumentNote): Promise<void>;
  listByDocument(saleDocumentId: number): Promise<SaleDocumentNote[]>;
  updateStatus(id: number, motorStatus: string): Promise<void>;
  findById(id: number): Promise<SaleDocumentNote | null>;
}
