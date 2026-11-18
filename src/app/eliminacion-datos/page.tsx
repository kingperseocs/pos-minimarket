import type { Metadata } from "next";
import { LEGAL_CONTACT, LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Eliminación de datos · Naveguz" };

export default function EliminacionDatosPage() {
  const { email } = LEGAL_CONTACT;
  return (
    <LegalPage title="Instrucciones para eliminar tus datos">
      <section>
        <p>Si deseas que eliminemos los datos que nos compartiste por WhatsApp:</p>
        <ul>
          <li>
            Escríbenos a <a className="underline" href={`mailto:${email}`}>{email}</a> o envía
            &quot;ELIMINAR MIS DATOS&quot; a nuestro WhatsApp desde el mismo número.
          </li>
          <li>Indica el número de teléfono con el que te comunicaste.</li>
          <li>Eliminaremos tus datos en un plazo máximo de 30 días y te confirmaremos por el mismo medio.</li>
        </ul>
      </section>
      <section>
        <p>
          Más información en nuestra <a className="underline" href="/privacidad">política de privacidad</a>.
        </p>
      </section>
    </LegalPage>
  );
}
