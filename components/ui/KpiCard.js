import React from "react";

export default function KpiCard({ title, value, icon, color, sub, children }) {
  // Extrai cores
  const textColorClass = color?.split(' ').find(c => c.startsWith('text-')) || 'text-slate-400';
  const borderColorClass = color?.split(' ').find(c => c.startsWith('border-')) || 'border-slate-200';

  return (
    <div className={`bg-white p-4 rounded-xl shadow-sm border border-slate-100 border-l-4 ${borderColorClass} flex flex-col justify-between h-full min-h-[110px]`}>
      <div className="flex justify-between items-start gap-3">
        <div className="flex flex-col justify-center flex-grow overflow-hidden">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide truncate mb-1">{title}</p>
          <p className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight truncate">{value}</p>
          
          {/* Subtítulo simples (ex: Venda + Fretes) */}
          {sub && <p className="text-[10px] text-slate-400 italic mt-1 truncate">{sub}</p>}
          
          {/* Conteúdo Customizado (ex: Detalhes M2) */}
          {children && <div className="mt-2">{children}</div>}
        </div>

        {/* Ícone com tamanho travado (shrink-0) para não ser esmagado */}
        <div className={`flex-shrink-0 w-10 h-10 md:w-12 md:h-12 flex items-center justify-center bg-slate-50 rounded-lg ${textColorClass}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}