import { after, NextResponse } from "next/server";
import { ZodError } from "zod";
import { issueSaleDocument } from "@/application/use-cases/e-invoicing/issue-sale-document";
import { createSaleUseCase } from "@/application/use-cases/sales/create-sale";
import {
  CashierNotFoundError,
  ForbiddenError,
  UnauthorizedError,
} from "@/domain/errors";
import { userWithPermission } from "@/infrastructure/auth/guards";
import { eInvoicingDeps, saleDeps } from "@/infrastructure/deps";

// Room for the electronic document sent right after the response (the motor
// waits for SUNAT). If it does not finish, the outbox retries it.
export const maxDuration = 60;

export async function POST(request: Request) {
  const user = await userWithPermission("sell");
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const result = await createSaleUseCase(
      saleDeps,
      body,
      user.id,
    );
    if (result.inserted) {
      // Issue the sale's document without making the till wait. Not durable
      // on its own: drainOutbox (called by every till after syncing) retries.
      after(async () => {
        try {
          await issueSaleDocument(eInvoicingDeps, result.uuid);
        } catch (error) {
          console.error("Electronic document issue failed", error);
        }
      });
    }
    return NextResponse.json({ synced: true, ...result });
  } catch (error) {
    // 401/403 are not the sale's fault: the client keeps it queued and
    // retries once the right cashier (or an admin) is logged in.
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: error.issues },
        { status: 400 },
      );
    }
    if (error instanceof CashierNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Sale sync failed", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
