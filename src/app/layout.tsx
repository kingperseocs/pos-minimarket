import type { Metadata } from "next";
import { Geist_Mono, Nunito } from "next/font/google";
import localFont from "next/font/local";
import { AuthSessionProvider } from "@/components/layout/auth-session-provider";
import { DevServiceWorkerReset } from "@/components/layout/dev-service-worker-reset";
import { SplashScreen } from "@/components/layout/splash-screen";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Roboto se sirve localmente: Google Fonts a veces responde con URLs
// `fonts.gstatic.com/l/font?kit=…&skey=…` que Turbopack no puede resolver
// ("next/font/google queries have exactly one entry").
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

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
