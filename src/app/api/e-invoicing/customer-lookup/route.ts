import { NextResponse } from "next/server";
import { lookupCustomerUseCase } from "@/application/use-cases/e-invoicing/lookup-customer";
import { userWithPermission } from "@/infrastructure/auth/guards";
import { companyLookup, DNI_LOOKUP_TIMEOUT_MS, identityLookup } from "@/infrastructure/identity";

// Name of the customer of a boleta (DNI) or factura (RUC), at checkout.
export async function POST(request: Request) {
  const user = await userWithPermission("sell");
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { docType?: unknown; number?: unknown } | null;
  const result = await lookupCustomerUseCase(
    { identity: identityLookup, companies: companyLookup },
    { docType: body?.docType, number: body?.number },
    DNI_LOOKUP_TIMEOUT_MS,
  );
  return NextResponse.json(result);
}
