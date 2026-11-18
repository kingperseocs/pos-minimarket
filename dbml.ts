import { pgGenerate } from "drizzle-dbml-generator";
import * as schema from "./src/infrastructure/db/schema";

// relational: false → usa las FK (.references()), que cubren todas las tablas;
// los relations() del schema solo describen algunas.
pgGenerate({ schema, out: "./docs/db/schema.dbml", relational: false });
