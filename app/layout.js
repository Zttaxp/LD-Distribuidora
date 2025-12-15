import "../styles/globals.css"; 

export const metadata = {
  title: "LD - Gestão",
  description: "Sistema de Business Intelligence e Gestão Financeira para Marmorarias",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-br">
      <body className="bg-slate-50">{children}</body>
    </html>
  );
}