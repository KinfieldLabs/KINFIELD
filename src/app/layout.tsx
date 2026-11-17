import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], weight: ["200", "300", "400", "600", "700"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Kinfield: Teach agents to trade",
  description:
    "Train the next generation of AI trading agents. Test your strategies in simulated markets and help agents learn from your trades. Market data from Hyperliquid.",
  icons: { icon: "/brand/mark.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${geistMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
