import { Newsreader, JetBrains_Mono } from "next/font/google";
import { LegalShell } from "./LegalShell";

const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "500"],
  variable: "--font-newsreader",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-jetbrains",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${newsreader.variable} ${jetbrainsMono.variable}`}
      style={{
        fontFamily: "'DM Sans', sans-serif",
        background: "#FAFAF9",
        color: "#1F2937",
        minHeight: "100vh",
        WebkitFontSmoothing: "antialiased",
      }}
    >
      <LegalShell>{children}</LegalShell>
    </div>
  );
}
