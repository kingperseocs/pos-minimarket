import type {
  CategorySales,
  DailySales,
  HourlySales,
  PaymentSales,
  ProductSales,
  SalesTotals,
} from "../entities/sales-analytics";

// Read-only aggregates over completed sales between two instants (by the
// time the sale was charged at the till). Grouping by day/hour uses the
// store's zone.
export interface SalesAnalyticsRepository {
  totals(from: Date, to: Date): Promise<SalesTotals>;
  daily(from: Date, to: Date): Promise<DailySales[]>;
  hourly(from: Date, to: Date): Promise<HourlySales[]>;
  topProducts(from: Date, to: Date, limit: number): Promise<ProductSales[]>;
  byCategory(from: Date, to: Date): Promise<CategorySales[]>;
  byPayment(from: Date, to: Date): Promise<PaymentSales[]>;
}
