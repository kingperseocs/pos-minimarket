import type { ReactNode } from "react";

// Datos del responsable que aparecen en las páginas legales públicas
// (Meta las exige para pasar la app de WhatsApp a modo "Live").
// TODO: confirmar con Naveguz el correo y el WhatsApp de contacto.
export const LEGAL_CONTACT = {
  business: "Naveguz",
  city: "Huánuco, Perú",
  email: "contacto@naveguz.pe",
  updatedAt: "17 de noviembre de 2026",
} as const;

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-sm leading-relaxed text-foreground">
      <h1 className="mb-1 text-2xl font-semibold">{title}</h1>
      <p className="mb-8 text-muted-foreground">
        {LEGAL_CONTACT.business} · Última actualización: {LEGAL_CONTACT.updatedAt}
      </p>
      <div className="space-y-6 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        {children}
      </div>
    </main>
  );
}
