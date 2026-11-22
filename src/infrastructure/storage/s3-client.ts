import { S3Client } from "@aws-sdk/client-s3";

// El almacenamiento de archivos habla el protocolo S3 (hoy Supabase Storage), así
// que el SDK de AWS se usa solo como cliente S3. Las variables AWS_* son la
// convención S3: toda petición va a AWS_ENDPOINT_URL_S3, no a AWS.
const REQUIRED_ENV = [
  "AWS_ENDPOINT_URL_S3",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_REGION",
] as const;

let client: S3Client | null = null;

// Created lazily so `next build` and pages that never touch images don't
// require storage credentials; the first upload/read fails loudly instead.
export function getS3Client() {
  if (client) return client;

  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `El almacenamiento S3 no está configurado. Faltan: ${missing.join(", ")}`,
    );
  }

  // Endpoint, region and credentials are read from the AWS_* variables by the
  // SDK's default provider chain. Supabase Storage usa direcciones path-style.
  client = new S3Client({ forcePathStyle: true });
  return client;
}

export const STORAGE_BUCKET = process.env.STORAGE_BUCKET ?? "assets";
