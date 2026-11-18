import type { PaymentType } from "@/domain/entities/sale";
import type {
  CategorySales,
  DailySales,
  HourlySales,
  PaymentSales,
  ProductSales,
  SalesTotals,
} from "@/domain/entities/sales-analytics";
import type { SalesAnalyticsRepository } from "@/domain/repositories/sales-analytics-repository";
import { storeDaysBetween } from "@/domain/services/analytics-period";
import { round2 } from "@/domain/value-objects/money";

// Made-up sales so the admin can see what the analysis looks like before the
// store has real ones. Deterministic (same day → same numbers), shaped like
// an airport minimarket: busy mornings and evenings, drinks and snacks first.
// Never written anywhere; the page labels it as an example.

type SampleProduct = {
  id: number;
  name: string;
  categoryId: number;
  price: number;
  cost: number;
  workerDiscount: number;
  weight: number;
};

const CATEGORIES = [
  { id: 1, name: "Bebidas" },
  { id: 2, name: "Snacks" },
  { id: 3, name: "Cafetería" },
  { id: 4, name: "Licores" },
  { id: 5, name: "Dulces" },
];

const PRODUCTS: SampleProduct[] = [
  { id: 1, name: "Inca Kola 500 ml", categoryId: 1, price: 3.5, cost: 2.3, workerDiscount: 0.5, weight: 14 },
  { id: 2, name: "Agua San Luis 625 ml", categoryId: 1, price: 2.5, cost: 1.4, workerDiscount: 0.5, weight: 12 },
  { id: 3, name: "Coca-Cola 500 ml", categoryId: 1, price: 3.5, cost: 2.4, workerDiscount: 0.5, weight: 10 },
  { id: 4, name: "Café americano", categoryId: 3, price: 6, cost: 2, workerDiscount: 1, weight: 9 },
  { id: 5, name: "Papas Lay's clásicas", categoryId: 2, price: 3, cost: 1.9, workerDiscount: 0.5, weight: 8 },
  { id: 6, name: "Galletas Oreo", categoryId: 5, price: 2, cost: 1.2, workerDiscount: 0, weight: 7 },
  { id: 7, name: "Sándwich de pollo", categoryId: 3, price: 9, cost: 4.5, workerDiscount: 1, weight: 5 },
  { id: 8, name: "Cerveza Pilsen 355 ml", categoryId: 4, price: 6.5, cost: 4.2, workerDiscount: 0, weight: 4 },
  { id: 9, name: "Chocolate Sublime", categoryId: 5, price: 2.5, cost: 1.5, workerDiscount: 0, weight: 6 },
  { id: 10, name: "Piqueo Karinto", categoryId: 2, price: 2.5, cost: 1.4, workerDiscount: 0, weight: 4 },
];

// Customers per hour on an average day (store time).
const HOURLY_TRAFFIC: Record<number, number> = {
  6: 3, 7: 6, 8: 8, 9: 6, 10: 4, 11: 4, 12: 6, 13: 7, 14: 4, 15: 4,
  16: 5, 17: 7, 18: 9, 19: 8, 20: 6, 21: 4, 22: 2,
};

const PAYMENTS: { type: PaymentType; weight: number }[] = [
  { type: "cash", weight: 5 },
  { type: "yape_plin", weight: 4 },
  { type: "card", weight: 2 },
];

type SampleSale = {
  at: number;
  dateKey: string;
  hour: number;
  paymentType: PaymentType;
  isWorker: boolean;
  lines: { product: SampleProduct; quantity: number; discount: number }[];
  total: number;
};

// Small seeded PRNG (mulberry32).
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T extends { weight: number }>(items: T[], r: number): T {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let x = r * total;
  for (const item of items) {
    x -= item.weight;
    if (x <= 0) return item;
  }
  return items[items.length - 1];
}

function salesOfDay(dateKey: string): SampleSale[] {
  const rand = random(Number(dateKey.replaceAll("-", "")));
  const weekday = new Date(`${dateKey}T12:00:00-05:00`).getUTCDay();
  // Weekends and a slow upward trend over time.
  const dayFactor =
    (weekday === 5 || weekday === 6 ? 1.25 : weekday === 0 ? 0.9 : 1) *
    (0.85 + rand() * 0.3) *
    (1 + ((Number(dateKey.slice(5, 7)) * 31 + Number(dateKey.slice(8))) % 60) / 400);

  const sales: SampleSale[] = [];
  for (const [hourText, traffic] of Object.entries(HOURLY_TRAFFIC)) {
    const hour = Number(hourText);
    const customers = Math.round(traffic * dayFactor * (0.7 + rand() * 0.6));
    for (let c = 0; c < customers; c++) {
      const isWorker = rand() < 0.22;
      const lines = new Map<number, { product: SampleProduct; quantity: number }>();
      const items = 1 + Math.floor(rand() * 3);
      for (let i = 0; i < items; i++) {
        const product = pick(PRODUCTS, rand());
        const line = lines.get(product.id) ?? { product, quantity: 0 };
        line.quantity += 1;
        lines.set(product.id, line);
      }
      let units = 3;
      const priced = [...lines.values()].map((line) => {
        const discounted = isWorker ? Math.min(units, line.quantity) : 0;
        units -= discounted;
        return { ...line, discount: round2(discounted * line.product.workerDiscount) };
      });
      const minute = Math.floor(rand() * 60);
      sales.push({
        at: new Date(
          `${dateKey}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00-05:00`,
        ).getTime(),
        dateKey,
        hour,
        paymentType: pick(PAYMENTS, rand()).type,
        isWorker,
        lines: priced,
        total: round2(
          priced.reduce((sum, l) => sum + l.product.price * l.quantity - l.discount, 0),
        ),
      });
    }
  }
  return sales;
}

function salesBetween(from: Date, to: Date) {
  return storeDaysBetween(from, to)
    .flatMap(salesOfDay)
    .filter((sale) => sale.at >= from.getTime() && sale.at <= to.getTime());
}

function sumBy<T>(items: T[], value: (item: T) => number) {
  return round2(items.reduce((sum, item) => sum + value(item), 0));
}

export class SampleSalesAnalyticsRepository implements SalesAnalyticsRepository {
  async totals(from: Date, to: Date): Promise<SalesTotals> {
    const sales = salesBetween(from, to);
    const lines = sales.flatMap((s) => s.lines);
    const revenue = sumBy(sales, (s) => s.total);
    return {
      revenue,
      orders: sales.length,
      units: lines.reduce((sum, l) => sum + l.quantity, 0),
      workerDiscount: sumBy(lines, (l) => l.discount),
      birthdayGifts: 0,
      workerRevenue: sumBy(sales.filter((s) => s.isWorker), (s) => s.total),
      profit: sales.length
        ? round2(revenue - sumBy(lines, (l) => l.product.cost * l.quantity))
        : null,
      costCoverage: sales.length ? 1 : 0,
    };
  }

  async daily(from: Date, to: Date): Promise<DailySales[]> {
    const byDay = new Map<string, DailySales>();
    for (const sale of salesBetween(from, to)) {
      const day = byDay.get(sale.dateKey) ?? { dateKey: sale.dateKey, revenue: 0, orders: 0 };
      day.revenue = round2(day.revenue + sale.total);
      day.orders += 1;
      byDay.set(sale.dateKey, day);
    }
    return [...byDay.values()];
  }

  async hourly(from: Date, to: Date): Promise<HourlySales[]> {
    const byHour = new Map<number, HourlySales>();
    for (const sale of salesBetween(from, to)) {
      const hour = byHour.get(sale.hour) ?? { hour: sale.hour, revenue: 0, orders: 0 };
      hour.revenue = round2(hour.revenue + sale.total);
      hour.orders += 1;
      byHour.set(sale.hour, hour);
    }
    return [...byHour.values()].sort((a, b) => a.hour - b.hour);
  }

  async topProducts(from: Date, to: Date, limit: number): Promise<ProductSales[]> {
    const byProduct = new Map<number, ProductSales>();
    for (const line of salesBetween(from, to).flatMap((s) => s.lines)) {
      const row = byProduct.get(line.product.id) ?? {
        productId: line.product.id,
        name: line.product.name,
        units: 0,
        revenue: 0,
      };
      row.units += line.quantity;
      row.revenue = round2(row.revenue + line.product.price * line.quantity - line.discount);
      byProduct.set(line.product.id, row);
    }
    return [...byProduct.values()].sort((a, b) => b.revenue - a.revenue).slice(0, limit);
  }

  async byCategory(from: Date, to: Date): Promise<CategorySales[]> {
    const byCategory = new Map<number, CategorySales>();
    for (const line of salesBetween(from, to).flatMap((s) => s.lines)) {
      const category = CATEGORIES.find((c) => c.id === line.product.categoryId)!;
      const row = byCategory.get(category.id) ?? {
        categoryId: category.id,
        name: category.name,
        revenue: 0,
      };
      row.revenue = round2(row.revenue + line.product.price * line.quantity - line.discount);
      byCategory.set(category.id, row);
    }
    return [...byCategory.values()].sort((a, b) => b.revenue - a.revenue);
  }

  async byPayment(from: Date, to: Date): Promise<PaymentSales[]> {
    const byType = new Map<PaymentType, PaymentSales>();
    for (const sale of salesBetween(from, to)) {
      const row = byType.get(sale.paymentType) ?? {
        paymentType: sale.paymentType,
        revenue: 0,
        orders: 0,
      };
      row.revenue = round2(row.revenue + sale.total);
      row.orders += 1;
      byType.set(sale.paymentType, row);
    }
    return [...byType.values()].sort((a, b) => b.revenue - a.revenue);
  }
}
