import { NextResponse } from "next/server";
import { z } from "zod";
import { userWithPermission } from "@/infrastructure/auth/guards";
import { saleDocumentRepository } from "@/infrastructure/repositories";

// The electronic document of a sale, so the till can print it as soon as the
// motor issued it (the till polls this right after charging).
export async function GET(_request: Request, ctx: RouteContext<"/api/e-invoicing/sales/[uuid]">) {
  const user = await userWithPermission("sell");
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uuid = z.uuid().safeParse((await ctx.params).uuid);
  if (!uuid.success) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const doc = await saleDocumentRepository.findBySaleUuid(uuid.data);
  if (!doc) {
    // Not synced yet (offline, or the sync is still running).
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({
    id: doc.id,
    docType: doc.docType,
    status: doc.status,
    number: doc.number,
    motorStatus: doc.motorStatus,
    reviewReasons: doc.reviewReasons,
    lastError: doc.status === "failed" ? doc.lastError : null,
  });
}
