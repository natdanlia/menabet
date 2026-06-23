import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bible Bee — Scripture Memorization",
  description: "Master your Bible Bee verses with the sequential progressive-erasure method.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body suppressHydrationWarning className="min-h-full flex flex-col bg-stone-50 text-stone-900 antialiased">
        {children}
      </body>
    </html>
  );
}
