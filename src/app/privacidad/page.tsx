import type { Metadata } from "next";
import { LEGAL_CONTACT, LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Política de privacidad · Naveguz" };

export default function PrivacidadPage() {
  const { business, city, email } = LEGAL_CONTACT;
  return (
    <LegalPage title="Política de privacidad">
      <section>
        <h2>1. Responsable</h2>
        <p>
          {business}, con domicilio en {city}, es responsable de los datos personales que se
          tratan a través de su canal de atención por WhatsApp.
        </p>
      </section>
      <section>
        <h2>2. Datos que recopilamos</h2>
        <ul>
          <li>Tu número de teléfono y nombre de perfil de WhatsApp.</li>
          <li>Los mensajes y opciones que nos envías por el chat.</li>
        </ul>
      </section>
      <section>
        <h2>3. Para qué los usamos</h2>
        <ul>
          <li>Atender reportes sobre nuestras máquinas expendedoras.</li>
          <li>Gestionar pedidos, solicitudes de compra o alquiler de máquinas y asesorías.</li>
          <li>Responder tus consultas. No enviamos publicidad sin tu consentimiento.</li>
        </ul>
      </section>
      <section>
        <h2>4. Con quién se comparten</h2>
        <p>
          Los mensajes se procesan mediante la plataforma WhatsApp Business de Meta Platforms, Inc.
          No vendemos ni cedemos tus datos a terceros.
        </p>
      </section>
      <section>
        <h2>5. Conservación</h2>
        <p>Conservamos los datos solo el tiempo necesario para atender tu solicitud.</p>
      </section>
      <section>
        <h2>6. Tus derechos</h2>
        <p>
          Conforme a la Ley N.º 29733 (Ley de Protección de Datos Personales del Perú), puedes
          solicitar el acceso, la rectificación, la cancelación o la oposición al tratamiento de tus
          datos escribiendo a <a className="underline" href={`mailto:${email}`}>{email}</a>. Consulta
          también nuestras{" "}
          <a className="underline" href="/eliminacion-datos">instrucciones de eliminación de datos</a>.
        </p>
      </section>
    </LegalPage>
  );
}
