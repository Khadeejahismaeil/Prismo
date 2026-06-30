import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { Fraunces } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Prismo, AI design reviewer",
  description:
    "Upload a screen and Prismo reviews hierarchy, spacing, contrast and CTA clarity, then scores it and shows you exactly what to fix.",
};

export const viewport: Viewport = {
  themeColor: "#f7f2e7",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <div className="app-bg" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
