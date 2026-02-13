import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "next-themes";
import "./globals.css";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://cloudtimer.dk"),
  title: {
    default: "Cloud Timer - Moderne tidsregistrering for teams",
    template: "%s | Cloud Timer",
  },
  description:
    "Registrer tid, styr projekter og øg teamets indtjening med Cloud Timer. Bygget til bureauer og konsulentvirksomheder.",
  keywords: [
    "tidsregistrering",
    "projektstyring",
    "team produktivitet",
    "timeseddel",
    "fakturering",
    "bureau",
    "time tracking",
    "project management",
  ],
  openGraph: {
    type: "website",
    siteName: "Cloud Timer",
    title: "Cloud Timer - Moderne tidsregistrering for teams",
    description:
      "Registrer tid, styr projekter og øg teamets indtjening med Cloud Timer.",
    url: "https://cloudtimer.dk",
    locale: "da_DK",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cloud Timer - Moderne tidsregistrering for teams",
    description:
      "Registrer tid, styr projekter og øg teamets indtjening med Cloud Timer.",
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
      <html lang="da" suppressHydrationWarning>
        <body
          className={`${dmSans.variable} ${jetbrainsMono.variable} font-sans`}
        >
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            {children}
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
