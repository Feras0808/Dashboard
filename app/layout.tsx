
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import CompanyLogosBackground from "@/components/company-logos-background";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "IT Support Dashboard",
  description: "Company IT support and ticket management portal",
};

export default function RootLayout({
  children,
}: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} min-h-full antialiased`}
    >
      <body className="relative min-h-screen">
        <CompanyLogosBackground />

        <div className="relative z-[1] min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
}
