import type { EInvoicingGateway } from "@/domain/repositories/e-invoicing-gateway";
import { MotorClient } from "./motor-client";

// The billing engine, over HTTP. Its configuration is read on first use.
export const eInvoicingGateway: EInvoicingGateway = new MotorClient();
