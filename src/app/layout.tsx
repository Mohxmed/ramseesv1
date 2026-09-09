import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import { AuthProvider } from "@/features/auth/context/AuthProvider";
import { ThemeGate } from "@/components/ui/mui-theme";
import "./globals.css";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "RAMSEES - نظام تداول البيتكوين",
  description: "نظام شخصي لتداول وتحليل البيتكوين",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${cairo.variable} h-full antialiased`}
    >
      <head>
        <meta charSet="UTF-8" />
      </head>
      <body className="min-h-full bg-zinc-950 text-zinc-100">
        <AuthProvider>
          <ThemeGate>{children}</ThemeGate>
        </AuthProvider>
      </body>
    </html>
  );
}
