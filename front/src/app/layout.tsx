import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ConfigProvider } from "@/contexts/ConfigContext";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { Providers } from "@/components/Providers";
import { Toaster } from 'sonner';

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Dashboard - Chatbot Reservas",
  description: "Sistema de gestión de reservas",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${dmSans.variable} font-sans`}>
        <Providers>
          <AuthProvider>
            <ThemeProvider>
              <ConfigProvider>
                <SidebarProvider>
                  {children}
                  <Toaster richColors closeButton position="top-right" />
                </SidebarProvider>
              </ConfigProvider>
            </ThemeProvider>
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}

