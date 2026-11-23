import type { Metadata } from "next";
import { Courier_Prime, JetBrains_Mono, Press_Start_2P } from "next/font/google";
import { Suspense } from "react";
import { Footer } from "@/components/footer";
import { Nav } from "@/components/nav";
import { UserProvider } from "@/components/user-provider";
import { getSessionUser } from "@/lib/supabase/session";
import "./globals.css";

const pressStart2P = Press_Start_2P({
  variable: "--font-press-start-2p",
  weight: "400",
  subsets: ["latin"],
});

const courierPrime = Courier_Prime({
  variable: "--font-courier-prime",
  weight: ["400", "700"],
  subsets: ["latin"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Arcade Vault · Portal Retro",
  description: "Juega clásicos arcade retro y compite por los mejores puntajes.",
};

async function SessionShell({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  return (
    <UserProvider user={user}>
      <Nav />
      <main className="av-main">{children}</main>
      <Footer />
    </UserProvider>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${pressStart2P.variable} ${courierPrime.variable} ${jetBrainsMono.variable}`}
    >
      <body>
        <div className="av-bg" />
        <div className="av-noise" />
        <div id="root">
          <Suspense fallback={null}>
            <SessionShell>{children}</SessionShell>
          </Suspense>
        </div>
      </body>
    </html>
  );
}
