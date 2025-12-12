import "../styles/globals.css"; 

export const metadata = {
  title: "Bi App",
  description: "Sistema de BI para planilhas",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-br">
      <body className="bg-slate-50">{children}</body>
    </html>
  );
}