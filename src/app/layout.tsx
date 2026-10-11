import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Splash } from "@/components/Splash";
import { ThemeProvider } from "@/components/ThemeProvider";

import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  title: "xenon.studio",
  description: "Online Booking System",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <Splash>
            {children}
            <Toaster />
          </Splash>
        </ThemeProvider>
      </body>
    </html>
  );
}
