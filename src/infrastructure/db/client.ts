import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

// Supabase: la app usa el "session pooler" (puerto 5432). El "transaction
// pooler" (6543) mezclaba los parámetros de consultas en paralelo (una fecha
// llegaba como "f"; probado el 2026-11-21), así que no se usa. prepare: false
// mantiene compatibilidad con cualquier pooler. En Vercel cada función abre su
// propio pool, así que se mantienen pocas conexiones (DB_POOL_MAX, 5 por defecto).
// En Vercel Production DB_POOL_MAX=1: el session pooler del plan gratis admite
// 15 clientes en total, y con 5 por copia se agotaba (EMAXCONNSESSION, 2026-11-22).
function createClient() {
  return postgres(process.env.DATABASE_URL!, {
    prepare: false,
    max: Number(process.env.DB_POOL_MAX || 5),
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

// En desarrollo, Next.js recarga módulos en caliente: se reutiliza el cliente
// para no abrir un pool nuevo en cada cambio.
const globalForDb = globalThis as unknown as { pgClient?: ReturnType<typeof postgres> };
const client = globalForDb.pgClient ?? createClient();
if (process.env.NODE_ENV !== "production") globalForDb.pgClient = client;

export const db = drizzle(client, { schema });
