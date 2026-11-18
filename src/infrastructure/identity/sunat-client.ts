import { IdentityServiceUnavailableError } from "@/domain/errors";

const SUNAT_BASE_URL = "https://ww1.sunat.gob.pe";
const SUNAT_LOOKUP_PATH = "/ol-ti-itfisdenreg/itfisdenreg.htm";

// GET on SUNAT's public lookup (the endpoint their own web forms use). It is
// not a formal API: it may change or throttle us, so every failure becomes
// IdentityServiceUnavailableError and the form falls back to manual typing.
export async function fetchSunatLookup<T>(
  params: Record<string, string>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  const url = new URL(SUNAT_LOOKUP_PATH, SUNAT_BASE_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        // SUNAT sometimes blocks requests without a browser User-Agent.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`SUNAT respondió ${response.status}`);
    }
    // When blocked, SUNAT answers with an HTML page: json() throws.
    return (await response.json()) as T;
  } catch (error) {
    console.error(`Consulta ${label} a SUNAT falló:`, (error as Error).message);
    throw new IdentityServiceUnavailableError();
  }
}
