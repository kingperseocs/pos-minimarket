import { NextResponse } from "next/server";
import { can } from "@/domain/entities/user";
import { MotorRejectedError, MotorUnavailableError } from "@/domain/errors";
import type { MotorFileKind, MotorPdfFormat } from "@/domain/repositories/e-invoicing-gateway";
import { userWithPermission } from "@/infrastructure/auth/guards";
import { eInvoicingGateway } from "@/infrastructure/e-invoicing";
import { saleDocumentRepository } from "@/infrastructure/repositories";

const KINDS: MotorFileKind[] = ["pdf", "xml", "cdr"];
const FORMATS: MotorPdfFormat[] = ["ticket", "a4", "a5"];

// The PDF / XML / CDR of a document, fetched from the motor with the POS's
// credentials (they never reach the browser). Looked up by the POS's own id:
// an arbitrary motor id is never accepted. A cashier gets those of the
// sales they charged; the admin, any.
export async function GET(request: Request, ctx: RouteContext<"/api/e-invoicing/documents/[id]/[kind]">) {
  const user = await userWithPermission("sell");
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, kind } = await ctx.params;
  const documentId = Number(id);
  if (!Number.isInteger(documentId) || !KINDS.includes(kind as MotorFileKind)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const doc = await saleDocumentRepository.findById(documentId);
  if (!doc || !doc.motorId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // A cashier gets the files of the sales they charged; the admin, any.
  if (!can(user.role, "manage") && doc.cashierId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const requested = new URL(request.url).searchParams.get("formato") ?? "ticket";
  const format = FORMATS.includes(requested as MotorPdfFormat) ? (requested as MotorPdfFormat) : "ticket";
  try {
    const file = await eInvoicingGateway.file(doc.motorId, kind as MotorFileKind, format);
    const headers = new Headers({ "Content-Type": file.contentType, "Cache-Control": "private, no-store" });
    // ?descarga=1 saves it instead of opening it in the browser.
    const download = new URL(request.url).searchParams.get("descarga") === "1";
    const disposition = file.contentDisposition ?? `inline; filename="${doc.number ?? "comprobante"}.${kind === "cdr" ? "zip" : kind}"`;
    headers.set("Content-Disposition", download ? disposition.replace(/^inline/, "attachment") : disposition);
    return new Response(file.body, { headers });
  } catch (error) {
    if (error instanceof MotorRejectedError) {
      return NextResponse.json({ error: error.message }, { status: error.status === 404 ? 404 : 422 });
    }
    if (error instanceof MotorUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    throw error;
  }
}
