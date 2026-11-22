import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

// Las migraciones van por una conexión de sesión (Supabase "session pooler",
// puerto 5432). Si no se define, se usa DATABASE_URL.
const url = process.env.MIGRATIONS_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL (o MIGRATIONS_DATABASE_URL) is not set");
}

export default defineConfig({
  schema: "./src/infrastructure/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url,
  },
});
