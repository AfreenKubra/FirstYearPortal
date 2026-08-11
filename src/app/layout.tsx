import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { DevToolbar } from "@/components/dev/DevToolbar";
import { branding } from "@/config/branding";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  axes: ["SOFT", "WONK"],
});

const body = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: {
    default: `${branding.product.name} · ${branding.institution.shortName}`,
    template: `%s · ${branding.product.name}`,
  },
  description: `${branding.product.tagline} portal for first-year students at ${branding.institution.name}.`,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        {children}
        {/*
          Agentation annotation toolbar, development only. Loaded through
          DevToolbar rather than imported directly — see the comment there for
          why a static import would ship 429 KB of it to production.
        */}
        {process.env.NODE_ENV === "development" && <DevToolbar />}
      </body>
    </html>
  );
}
