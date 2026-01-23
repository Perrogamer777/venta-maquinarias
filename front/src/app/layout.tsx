import type { Metadata } from "next";
import { Sora, Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ConfigProvider } from "@/contexts/ConfigContext";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { Providers } from "@/components/Providers";
import { Toaster } from 'sonner';

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MACI - Dashboard",
  description: "Sistema de gestión de venta de maquinaria",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${sora.variable} ${inter.variable} font-sans`}>
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
