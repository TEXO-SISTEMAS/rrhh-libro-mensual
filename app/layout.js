import './globals.css';
import { Poppins } from 'next/font/google';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  display: 'swap',
});

export const metadata = {
  title: 'Libro Mensual | Texo',
  description: 'Generador de Libros Mensuales PERL023 — Ministerio de Trabajo de Paraguay',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={poppins.className}>
      <body>{children}</body>
    </html>
  );
}
