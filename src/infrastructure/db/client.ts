import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

// Supabase: la app usa el "transaction pooler" (puerto 6543), que no admite
// sentencias preparadas; por eso prepare: false. En Vercel cada función abre su
// propio pool, así que se mantienen pocas conexiones (DB_POOL_MAX, 5 por defecto).
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
