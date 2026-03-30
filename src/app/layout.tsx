import type { Metadata } from "next";
import { Playfair_Display, Instrument_Sans } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-heading",
  subsets: ["latin"],
});

const instrument = Instrument_Sans({
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
    <html lang="en" className={`${playfair.variable} ${instrument.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans selection:bg-primary/20">
        <div className="fixed inset-0 pointer-events-none z-[9999] opacity-[0.03] mix-blend-multiply grain-overlay" />
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
