import { NextResponse } from "next/server";
import { drainOutbox } from "@/application/use-cases/e-invoicing/issue-sale-document";
import { userWithPermission } from "@/infrastructure/auth/guards";
import { eInvoicingDeps } from "@/infrastructure/deps";

// Each document may wait up to 20 s for the motor (which waits for SUNAT).
export const maxDuration = 60;

// Sends the electronic documents whose turn has come. Every open till calls
// it after syncing, so the queue keeps moving without a cron; the admin's
// "Reintentar pendientes" uses it too.
export async function POST() {
  const user = await userWithPermission("sell");
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const counts = await drainOutbox(eInvoicingDeps);
    return NextResponse.json(counts);
  } catch (error) {
    console.error("Electronic document drain failed", error);
    return NextResponse.json({ error: "Drain failed" }, { status: 500 });
  }
}
