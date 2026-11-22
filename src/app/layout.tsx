import type { Metadata } from "next";
import localFont from "next/font/local";
import { AuthSessionProvider } from "@/components/layout/auth-session-provider";
import { DevServiceWorkerReset } from "@/components/layout/dev-service-worker-reset";
import { SplashScreen } from "@/components/layout/splash-screen";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Todas las fuentes se sirven localmente (@fontsource-variable). Google Fonts a
// veces responde con URLs `fonts.gstatic.com/l/font?kit=…&skey=…` sin extensión:
// Turbopack no las resuelve y next/font/google rompe el build con webpack
// ("Cannot read properties of null (reading '1')"). Le pasó a Vercel y al CI
// el 2026-11-22 con Nunito y Geist Mono.
const roboto = localFont({
  variable: "--font-roboto",
  src: [
    {
      path: "../../node_modules/@fontsource-variable/roboto/files/roboto-latin-wght-normal.woff2",
      weight: "100 900",
      style: "normal",
    },
  ],
  display: "swap",
});

const nunito = localFont({
  variable: "--font-nunito",
  src: [
    {
      path: "../../node_modules/@fontsource-variable/nunito/files/nunito-latin-wght-normal.woff2",
      weight: "200 1000",
      style: "normal",
    },
  ],
  display: "swap",
});

const geistMono = localFont({
  variable: "--font-geist-mono",
  src: [
    {
      path: "../../node_modules/@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2",
      weight: "100 900",
      style: "normal",
    },
  ],
  display: "swap",
});

export const metadata: Metadata = {
  title: "NAVEXPRESS",
  description: "NAVEXPRESS: punto de venta para minimarket",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${roboto.variable} ${nunito.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthSessionProvider>{children}</AuthSessionProvider>
        <SplashScreen />
        <Toaster />
        {process.env.NODE_ENV === "development" && <DevServiceWorkerReset />}
      </body>
    </html>
  );
}
