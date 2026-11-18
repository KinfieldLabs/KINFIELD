import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { pageMeta, SITE_URL } from "@/lib/meta";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], weight: ["200", "300", "400", "600", "700"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  ...pageMeta(
    "/",
    "Kinfield: Teach agents to trade",
    "Train the next generation of AI trading agents. Test your strategies in simulated markets and help agents learn from your trades. Powered by Hyperliquid.",
  ),
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Hide reveals for their entrance only once scripts run, and show everything if the animations don't start */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "var d=document.documentElement;d.classList.add('motion');setTimeout(function(){if(!d.classList.contains('motion-ready'))d.classList.remove('motion')},4000)",
          }}
        />
      </head>
      <body className={`${inter.variable} ${geistMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
