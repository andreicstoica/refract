import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Edu_SA_Beginner, IBM_Plex_Sans } from "next/font/google";
import "../index.css";
import Providers from "@/components/layout/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const eduCursive = Edu_SA_Beginner({
  variable: "--font-edu-cursive",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Refract - the journal that nudges you deeper",
  description:
    "Refract uses AI to gently push you deeper into your writing and help you notice new patterns.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${ibmPlexSans.variable} ${geistSans.variable} ${geistMono.variable} ${eduCursive.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
