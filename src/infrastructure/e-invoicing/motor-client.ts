import { z } from "zod";
import { MotorRejectedError, MotorUnavailableError } from "@/domain/errors";
import type {
  EInvoicingGateway,
  MotorBatch,
  MotorDocument,
  MotorFile,
  MotorFileKind,
  MotorNoteRequest,
  MotorPdfFormat,
} from "@/domain/repositories/e-invoicing-gateway";
import type { SaleDocumentType } from "@/domain/entities/sale-document";
import type { MotorIssueRequest } from "@/domain/services/e-invoice";

// Server-only: the motor's API key and secret must never reach the browser
// (no NEXT_PUBLIC_ here; only imported from route handlers and actions).

const configSchema = z.object({
  MOTOR_URL: z.url(),
  MOTOR_API_KEY: z.string().min(1),
  MOTOR_API_SECRET: z.string().min(1),
});

export interface MotorConfig {
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
}

// Read on first use (like the S3 client), so `next build` and pages that
// never invoice don't need the variables.
export function motorConfig(env: Record<string, string | undefined> = process.env): MotorConfig {
  const parsed = configSchema.safeParse(env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`La facturación electrónica no está configurada: ${missing}`);
  }
  return {
    baseUrl: parsed.data.MOTOR_URL.replace(/\/+$/, ""),
    apiKey: parsed.data.MOTOR_API_KEY,
    apiSecret: parsed.data.MOTOR_API_SECRET,
  };
}

// Issuing waits for SUNAT inside the motor's request, so it gets more time.
export const MOTOR_ISSUE_TIMEOUT_MS = 20_000;
export const MOTOR_TIMEOUT_MS = 10_000;

const documentSchema = z.object({
  id: z.string(),
  numero: z.string(),
  estado: z.string(),
  sunat: z
    .object({ codigo: z.number().nullable().optional(), descripcion: z.string().nullable().optional() })
    .optional(),
});

const batchSchema = z.object({ id: z.string(), identificador: z.string(), estado: z.string() });

const errorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.array(z.object({ field: z.string().optional(), message: z.string() })).optional(),
  }),
});

function toDocument(data: unknown): MotorDocument {
  const d = documentSchema.parse(data);
  return {
    id: d.id,
    number: d.numero,
    status: d.estado,
    sunatCode: d.sunat?.codigo ?? null,
    sunatDescription: d.sunat?.descripcion ?? null,
  };
}

export class MotorClient implements EInvoicingGateway {
  constructor(
    private readonly config: () => MotorConfig = () => motorConfig(),
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async request(
    method: "GET" | "POST",
    path: string,
    options: { body?: unknown; idempotencyKey?: string; timeoutMs?: number } = {},
  ): Promise<Response> {
    const cfg = this.config();
    const headers: Record<string, string> = {
      "X-Api-Key": cfg.apiKey,
      "X-Api-Secret": cfg.apiSecret,
    };
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;

    let res: Response;
    try {
      res = await this.fetchImpl(`${cfg.baseUrl}/api/v1${path}`, {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        cache: "no-store",
        signal: AbortSignal.timeout(options.timeoutMs ?? MOTOR_TIMEOUT_MS),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new MotorUnavailableError(`El motor de facturación no respondió: ${reason}`);
    }
    if (res.status >= 500) {
      throw new MotorUnavailableError(`El motor de facturación falló (HTTP ${res.status}).`);
    }
    if (!res.ok) {
      const parsed = errorSchema.safeParse(await res.json().catch(() => null));
      if (parsed.success) {
        const { code, message, details } = parsed.data.error;
        throw new MotorRejectedError(res.status, code, message, details ?? []);
      }
      throw new MotorRejectedError(res.status, "HTTP_" + res.status, `El motor rechazó la petición (HTTP ${res.status}).`);
    }
    return res;
  }

  private async data(res: Response): Promise<unknown> {
    const body = (await res.json()) as { data?: unknown };
    return body.data;
  }

  async issue(type: SaleDocumentType, request: MotorIssueRequest, idempotencyKey: string) {
    const path = type === "factura" ? "/facturas" : "/boletas";
    const res = await this.request("POST", path, {
      body: request,
      idempotencyKey,
      timeoutMs: MOTOR_ISSUE_TIMEOUT_MS,
    });
    return toDocument(await this.data(res));
  }

  async get(motorId: string) {
    return toDocument(await this.data(await this.request("GET", `/comprobantes/${encodeURIComponent(motorId)}`)));
  }

  async file(motorId: string, kind: MotorFileKind, format: MotorPdfFormat = "ticket"): Promise<MotorFile> {
    const query = kind === "pdf" ? `?formato=${format}` : "";
    const res = await this.request("GET", `/comprobantes/${encodeURIComponent(motorId)}/${kind}${query}`);
    if (!res.body) throw new MotorUnavailableError("El motor devolvió un archivo vacío.");
    return {
      body: res.body,
      contentType: res.headers.get("Content-Type") ?? "application/octet-stream",
      contentDisposition: res.headers.get("Content-Disposition"),
    };
  }

  async void(motorId: string, reason: string): Promise<MotorBatch> {
    const res = await this.request("POST", `/comprobantes/${encodeURIComponent(motorId)}/anular`, {
      body: { motivo: reason },
      timeoutMs: MOTOR_ISSUE_TIMEOUT_MS,
    });
    const b = batchSchema.parse(await this.data(res));
    return { id: b.id, identifier: b.identificador, status: b.estado };
  }

  async creditNote(request: MotorNoteRequest, idempotencyKey: string) {
    const res = await this.request("POST", "/notas-credito", {
      body: request,
      idempotencyKey,
      timeoutMs: MOTOR_ISSUE_TIMEOUT_MS,
    });
    return toDocument(await this.data(res));
  }

  async debitNote(request: MotorNoteRequest, idempotencyKey: string) {
    const res = await this.request("POST", "/notas-debito", {
      body: request,
      idempotencyKey,
      timeoutMs: MOTOR_ISSUE_TIMEOUT_MS,
    });
    return toDocument(await this.data(res));
  }

  async dailyReport(date: string) {
    return this.data(await this.request("GET", `/reportes/diario?fecha=${encodeURIComponent(date)}`));
  }
}
