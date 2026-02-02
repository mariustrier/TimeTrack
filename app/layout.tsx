import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "next-themes";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://cloudtimer.dk"),
  title: {
    default: "Cloud Timer - Modern Time Tracking for Teams",
    template: "%s | Cloud Timer",
  },
  description:
    "Track time, manage projects, and boost team profitability with Cloud Timer. Built for agencies and consultancies.",
  keywords: [
    "time tracking",
    "project management",
    "team productivity",
    "timesheet",
    "billing",
    "agency",
  ],
  openGraph: {
    type: "website",
    siteName: "Cloud Timer",
    title: "Cloud Timer - Modern Time Tracking for Teams",
    description:
      "Track time, manage projects, and boost team profitability.",
    url: "https://cloudtimer.dk",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cloud Timer - Modern Time Tracking for Teams",
    description:
      "Track time, manage projects, and boost team profitability.",
  },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className={inter.className}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            {children}
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
