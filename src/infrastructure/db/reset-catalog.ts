// Fresh start after testing: deletes the catalog, the sales history and
// everything hanging from them. Suppliers, users, workers, discount policies,
// promo discounts, schedules/attendance and locations are kept.
//
//   pnpm db:reset-catalog         → only shows what would be deleted
//   pnpm db:reset-catalog --yes   → deletes it (ids start again at 1)
import "./load-env";

import postgres from "postgres";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");

// Every table that references products, categories or sales, plus what the
// owner asked to clear with them (cash shifts, points, audit log).
const TABLES: { table: string; label: string }[] = [
  { table: "sales", label: "Ventas" },
  { table: "sale_items", label: "Detalle de ventas" },
  { table: "loyalty_ledger", label: "Movimientos de puntos" },
  { table: "cash_shifts", label: "Turnos de caja" },
  { table: "cash_movements", label: "Movimientos de caja" },
  { table: "categories", label: "Categorías" },
  { table: "products", label: "Productos" },
  { table: "product_presentations", label: "Presentaciones" },
  { table: "supplier_categories", label: "Categorías asignadas a proveedores" },
  { table: "stock_levels", label: "Stock por ubicación" },
  { table: "stock_lots", label: "Lotes" },
  { table: "stock_movements", label: "Kardex" },
  { table: "stock_counts", label: "Conteos" },
  { table: "stock_count_items", label: "Detalle de conteos" },
  { table: "stock_transfers", label: "Traslados" },
  { table: "stock_transfer_items", label: "Detalle de traslados" },
  { table: "goods_receipts", label: "Ingresos (facturas)" },
  { table: "goods_receipt_items", label: "Detalle de ingresos" },
  { table: "receipt_discrepancies", label: "Diferencias de ingreso" },
  { table: "audit_events", label: "Auditoría" },
];

// Must survive untouched.
const KEPT = ["suppliers", "supplier_bank_accounts", "users", "workers"];

const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });

async function countRows(tx: postgres.Sql | postgres.TransactionSql, table: string) {
  const [row] = await tx.unsafe<{ n: number }[]>(`select count(*)::int as n from "${table}"`);
  return row.n;
}

async function counts(tx: postgres.Sql | postgres.TransactionSql, tables: string[]) {
  const result: Record<string, number> = {};
  for (const table of tables) result[table] = await countRows(tx, table);
  return result;
}

async function main() {
  const confirmed = process.argv.includes("--yes");
  const before = await counts(sql, TABLES.map((t) => t.table));

  console.log(confirmed ? "\nBorrando:" : "\nSe borraría (nada cambia sin --yes):");
  for (const { table, label } of TABLES) {
    console.log(`  ${label.padEnd(36)} ${String(before[table]).padStart(6)}`);
  }
  const kept = await counts(sql, KEPT);
  console.log("\nSe conserva:");
  console.log(`  Proveedores ${kept.suppliers} · cuentas bancarias ${kept.supplier_bank_accounts} · usuarios ${kept.users} · trabajadores ${kept.workers}`);

  if (!confirmed) {
    console.log("\nPara borrar de verdad: pnpm db:reset-catalog --yes\n");
    return;
  }

  await sql.begin(async (tx) => {
    const list = TABLES.map((t) => `"${t.table}"`).join(", ");
    await tx.unsafe(`truncate table ${list} restart identity`);
    // Points come from the deleted sales.
    await tx.unsafe(`update "workers" set "points_balance" = 0 where "points_balance" <> 0`);

    const after = await counts(tx, KEPT);
    for (const table of KEPT) {
      if (after[table] !== kept[table]) {
        throw new Error(`${table} cambió (${kept[table]} → ${after[table]}): no se borró nada`);
      }
    }
  });

  console.log("\nListo: catálogo, ventas, inventario y auditoría en blanco.");
  console.log("Los proveedores siguen ahí, pero sin categorías asignadas: elígelas de nuevo al editarlos.");
  console.log("En cada caja, recarga el POS para que baje el catálogo vacío.\n");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
