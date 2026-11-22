import { NextResponse } from "next/server";
import { MotorRejectedError, MotorUnavailableError } from "@/domain/errors";
import { userWithPermission } from "@/infrastructure/auth/guards";
import { eInvoicingGateway } from "@/infrastructure/e-invoicing";
import { saleDocumentNoteRepository } from "@/infrastructure/repositories";

// PDF of a credit or debit note (admin only), from the motor.
export async function GET(request: Request, ctx: RouteContext<"/api/e-invoicing/notes/[id]/pdf">) {
  const user = await userWithPermission("manage");
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = Number((await ctx.params).id);
  const note = Number.isInteger(id) ? await saleDocumentNoteRepository.findById(id) : null;
  if (!note || note.kind === "void" || !note.motorId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const format = new URL(request.url).searchParams.get("formato") === "a4" ? "a4" : "ticket";
  try {
    const file = await eInvoicingGateway.file(note.motorId, "pdf", format);
    const headers = new Headers({ "Content-Type": file.contentType, "Cache-Control": "private, no-store" });
    if (file.contentDisposition) headers.set("Content-Disposition", file.contentDisposition);
    return new Response(file.body, { headers });
  } catch (error) {
    if (error instanceof MotorRejectedError || error instanceof MotorUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    throw error;
  }
}
