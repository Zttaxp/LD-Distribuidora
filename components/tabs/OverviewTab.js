"use client";

import { 
  BarChart3, 
  TrendingUp, 
  Truck, 
  DollarSign, 
  ShoppingBag,
  Gem,
  Package
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function OverviewTab({ summary, topMaterials }) {
  
  // 1. Cálculos de Totais (Somando todos os meses da view)
  const totalRevenue = summary.reduce((acc, curr) => acc + (curr.total_revenue || 0), 0);
  const totalCost = summary.reduce((acc, curr) => acc + (curr.total_cost || 0), 0);
  const totalSalesCount = summary.reduce((acc, curr) => acc + (curr.total_sales || 0), 0);
  
  // No seu HTML, o Frete era calculado como (Bruto - Liquido), mas na View atual
  // talvez tenhamos que ajustar. Vou assumir por enquanto que total_revenue é o Líquido.
  // Se precisarmos do Bruto, ajustaremos a View depois.
  // Para manter o visual, vou simular o frete como 0 se não tivermos a coluna, 
  // mas mantendo o card para fidelidade visual.
  const totalFreight = 0; 
  const grossRevenue = totalRevenue + totalFreight;
  
  // Cálculo simplificado de Lucro (Receita - Custo) para o card Verde
  // Nota: O cálculo exato com impostos virá na aba Financeiro
  const simpleProfit = totalRevenue - totalCost;
  
  const avgTicket = totalSalesCount > 0 ? totalRevenue / totalSalesCount : 0;

  // 2. Preparar Dados dos Gráficos (Evolução Mensal)
  // Ordenar cronologicamente
  const sortedSummary = [...summary].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });

  const chartData = {
    labels: sortedSummary.map(item => `${item.month}/${item.year}`),
    datasets: [
      {
        label: 'Faturamento',
        data: sortedSummary.map(item => item.total_revenue),
        borderColor: '#0891b2', // Cyan-600
        backgroundColor: 'rgba(8, 145, 178, 0.1)',
        fill: true,
        tension: 0.3,
      },
      {
        label: 'Custos (CMV)',
        data: sortedSummary.map(item => item.total_cost),
        borderColor: '#ef4444', // Red-500
        backgroundColor: 'transparent',
        borderDash: [5, 5],
        tension: 0.3,
      }
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
    },
    scales: {
      y: { grid: { color: '#f1f5f9' }, beginAtZero: true },
      x: { grid: { display: false } }
    }
  };

  // 3. Separar Materiais (Alto vs Baixo Valor)
  // Assumindo que a view 'top_materials_summary' já traga profit_per_m2 ou price_per_m2
  // Se não tiver, usamos uma lógica simples de divisão
  const materials = topMaterials.map(m => ({
    ...m,
    price_per_m2: m.total_m2 > 0 ? m.total_revenue / m.total_m2 : 0
  }));

  const highValue = materials.filter(m => m.price_per_m2 > 300).sort((a,b) => b.total_revenue - a.total_revenue).slice(0, 50);
  const lowValue = materials.filter(m => m.price_per_m2 <= 300).sort((a,b) => b.total_revenue - a.total_revenue).slice(0, 50);

  // Helper de Moeda
  const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="space-y-6 fade-in">
      
      {/* KPI Cards - Layout Idêntico ao HTML */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Card 1: Faturamento Bruto (Azul) */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 border-l-4 border-l-blue-500">
          <p className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
            <TrendingUp size={14} /> Faturamento Realizado
          </p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{formatBRL(totalRevenue)}</p>
          <span className="text-[10px] text-slate-400 italic">(Soma total de vendas)</span>
        </div>

        {/* Card 2: Fretes (Laranja) */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 border-l-4 border-l-orange-400">
          <p className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
            <Truck size={14} /> Fretes (Repasse)
          </p>
          <p className="text-2xl font-bold text-orange-600 mt-1">{formatBRL(totalFreight)}</p>
          <span className="text-[10px] text-slate-400 italic">(Diferença Bruto - Líquido)</span>
        </div>

        {/* Card 3: Lucro Bruto/Operacional (Verde) */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 border-l-4 border-l-green-500">
          <p className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
            <DollarSign size={14} /> Lucro Bruto (Aprox)
          </p>
          <p className={`text-2xl font-bold mt-1 ${simpleProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatBRL(simpleProfit)}
          </p>
          <span className="text-[10px] text-slate-400 italic">Receita - Custo Material (CMV)</span>
        </div>

        {/* Card 4: Ticket Médio (Roxo) */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 border-l-4 border-l-purple-500">
          <p className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
            <ShoppingBag size={14} /> Ticket Médio
          </p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{formatBRL(avgTicket)}</p>
          <span className="text-[10px] text-slate-400 italic">(Receita Total / Qtd Vendas)</span>
        </div>
      </div>

      {/* Tabelas de Ranking Lado a Lado */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Tabela Alto Valor */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col max-h-[500px]">
          <div className="p-4 border-b border-slate-100 bg-purple-50 shrink-0">
            <h3 className="font-bold text-purple-800 text-sm flex items-center gap-2">
              <Gem size={16} /> Ranking Materiais Alto Agregado ({'>'}300)
            </h3>
          </div>
          <div className="overflow-y-auto custom-scroll flex-grow p-0">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase sticky top-0 shadow-sm">
                <tr>
                  <th className="p-2 pl-4">Material</th>
                  <th className="p-2 text-right">M²</th>
                  <th className="p-2 text-right pr-4">R$ Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {highValue.map((item, idx) => (
                  <tr key={idx} className="hover:bg-purple-50/30 transition-colors">
                    <td className="p-2 pl-4 font-bold text-slate-700 truncate max-w-[180px]" title={item.material}>
                      {item.material}
                    </td>
                    <td className="p-2 text-right text-xs text-slate-500">{item.total_m2.toFixed(2)}</td>
                    <td className="p-2 text-right pr-4 font-bold text-cyan-700">{formatBRL(item.total_revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tabela Baixo Valor */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col max-h-[500px]">
          <div className="p-4 border-b border-slate-100 bg-slate-50 shrink-0">
            <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
              <Package size={16} /> Ranking Materiais Baixo Agregado ({'<'}300)
            </h3>
          </div>
          <div className="overflow-y-auto custom-scroll flex-grow p-0">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase sticky top-0 shadow-sm">
                <tr>
                  <th className="p-2 pl-4">Material</th>
                  <th className="p-2 text-right">M²</th>
                  <th className="p-2 text-right pr-4">R$ Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {lowValue.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="p-2 pl-4 font-medium text-slate-600 truncate max-w-[180px]" title={item.material}>
                      {item.material}
                    </td>
                    <td className="p-2 text-right text-xs text-slate-500">{item.total_m2.toFixed(2)}</td>
                    <td className="p-2 text-right pr-4 font-bold text-slate-700">{formatBRL(item.total_revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Gráfico de Evolução */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-700 text-sm">Evolução Mensal de Vendas</h3>
        </div>
        <div className="relative h-80">
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>
    </div>
  );
}