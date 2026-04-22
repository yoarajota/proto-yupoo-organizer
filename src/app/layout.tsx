import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const jetbrainsMonoHeading = JetBrains_Mono({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["700"],
});

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Yupoo Organizer | Sourcing Atelier",
  description: "A premium workspace for your Yupoo sourcing workflow.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${jetbrainsMonoHeading.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans selection:bg-primary/20">
        <div className="fixed inset-0 pointer-events-none z-[9999] opacity-[0.03] mix-blend-multiply grain-overlay" />
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
