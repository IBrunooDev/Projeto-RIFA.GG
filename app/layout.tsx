import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rifa.GG",
  description: "Rifas organizadas para comunidades dentro do jogo.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
