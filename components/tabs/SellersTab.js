"use client";

import { Trophy } from 'lucide-react';
import KpiCard from '@/components/ui/KpiCard';

export default function SellersTab({ sellers = [] }) {
  
  // Tratamento caso a tabela esteja vazia
  if (!sellers || sellers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-white rounded-xl border border-gray-100">
        <Trophy className="text-gray-300 mb-2" size={48} />
        <p className="text-gray-500">Nenhum dado de vendas encontrado.</p>
        <p className="text-xs text-gray-400 mt-1">Importe uma planilha para ver o ranking.</p>
      </div>
    );
  }

  // O melhor vendedor é o primeiro da lista (o banco já traz ordenado por receita)
  const topSeller = sellers[0];
  
  // Soma total de todos os vendedores para calcular %
  const totalRevenueAll = sellers.reduce((acc, curr) => acc + curr.total_revenue, 0);

  return (
    <div className="space-y-6">
      {/* Cards de Destaque */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard
          title="Melhor Vendedor(a)"
          value={topSeller.seller}
          icon={<Trophy className="text-yellow-600" size={24} />}
        >
          <span className="text-xs text-gray-500">
            R$ {topSeller.total_revenue.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} em vendas
          </span>
        </KpiCard>
        
        <KpiCard
          title="Total Vendedores"
          value={sellers.length.toString()}
          icon={<UsersIcon className="text-blue-600" />}
        >
          <span className="text-xs text-gray-500">Ativos no período</span>
        </KpiCard>
      </div>

      {/* Tabela de Ranking */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-800">Ranking de Performance</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 font-medium">
              <tr>
                <th className="px-6 py-4">#</th>
                <th className="px-6 py-4">Vendedor</th>
                <th className="px-6 py-4 text-center">Vendas (Qtd)</th>
                <th className="px-6 py-4 text-center">Área (m²)</th>
                <th className="px-6 py-4 text-right">Ticket Médio</th>
                <th className="px-6 py-4 text-right">Faturamento</th>
                <th className="px-6 py-4 text-right">Share (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sellers.map((item, index) => (
                <tr key={item.seller} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                     <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${index < 3 ? 'bg-blue-100 text-blue-700' : 'text-gray-400'}`}>
                      {index + 1}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-800">
                    {item.seller}
                  </td>
                  <td className="px-6 py-4 text-center text-gray-600">{item.total_sales}</td>
                  <td className="px-6 py-4 text-center text-gray-600">{item.total_m2.toFixed(2)}</td>
                  <td className="px-6 py-4 text-right text-gray-600">
                    R$ {item.avg_ticket?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0,00'}
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-gray-800">
                    R$ {item.total_revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                   <td className="px-6 py-4 text-right text-gray-500">
                    {totalRevenueAll > 0 
                      ? ((item.total_revenue / totalRevenueAll) * 100).toFixed(1) 
                      : 0}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Pequeno helper para ícone se não tiver importado
function UsersIcon({ className }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" height="24" viewBox="0 0 24 24" 
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" 
      className={className}
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}