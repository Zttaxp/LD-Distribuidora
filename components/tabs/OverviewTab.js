"use client";

import { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Package, 
  Layers 
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
import KpiCard from '@/components/ui/KpiCard'; // Seu componente visual existente

// Registro do Chart.js
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

export default function OverviewTab({ summary = [], topMaterials = [] }) {
  // Estado de filtro simples (Ex: mostrar últimos 12 meses ou tudo)
  const [filterYear, setFilterYear] = useState('ALL');

  // 1. Extrair anos únicos para o filtro (Baseado nos dados carregados)
  const availableYears = useMemo(() => {
    const years = summary.map(item => item.year);
    return [...new Set(years)].sort((a, b) => b - a); // Decrescente
  }, [summary]);

  // 2. Filtrar os dados agregados baseados na seleção
  const filteredData = useMemo(() => {
    if (filterYear === 'ALL') return summary;
    // O summary vem ordenado do banco? Se não, ideal ordenar por data aqui
    return summary
      .filter(item => item.year === parseInt(filterYear))
      .sort((a, b) => new Date(a.month_key) - new Date(b.month_key));
  }, [summary, filterYear]);

  // 3. Cálculos de Totais (Agora somamos os totais mensais, super rápido)
  const totals = useMemo(() => {
    return filteredData.reduce((acc, curr) => ({
      revenue: acc.revenue + (curr.total_revenue || 0),
      cost: acc.cost + (curr.total_cost || 0),
      m2: acc.m2 + (curr.total_m2 || 0),
      sales_count: acc.sales_count + (curr.total_sales || 0)
    }), { revenue: 0, cost: 0, m2: 0, sales_count: 0 });
  }, [filteredData]);

  // Cálculo de Margem
  const grossMargin = totals.revenue > 0 
    ? ((totals.revenue - totals.cost) / totals.revenue) * 100 
    : 0;

  // 4. Configuração do Gráfico
  const chartData = {
    labels: filteredData.map(item => {
      // Formata "2024-01" para "Jan/24"
      const [ano, mes] = item.month_key.split('-');
      const date = new Date(ano, mes - 1);
      return date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
    }),
    datasets: [
      {
        label: 'Faturamento',
        data: filteredData.map(item => item.total_revenue),
        borderColor: '#2563eb', // blue-600
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'Custos',
        data: filteredData.map(item => item.total_cost),
        borderColor: '#ef4444', // red-500
        backgroundColor: 'transparent',
        borderDash: [5, 5],
        tension: 0.4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: (context) => {
            return ` ${context.dataset.label}: R$ ${context.raw.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
          }
        }
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => `R$ ${value / 1000}k`, // Abrevia valores no eixo Y
        },
      },
    },
  };

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex justify-end mb-4">
        <select 
          value={filterYear}
          onChange={(e) => setFilterYear(e.target.value)}
          className="bg-white border border-gray-300 text-gray-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
        >
          <option value="ALL">Todo o Período</option>
          {availableYears.map(year => (
            <option key={year} value={year}>Ano {year}</option>
          ))}
        </select>
      </div>

      {/* Cards de KPI */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard 
          title="Faturamento Total" 
          value={`R$ ${totals.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={<DollarSign className="text-blue-600" size={24} />}
          trend={null} 
        >
          <span className="text-xs text-gray-500">
            {totals.sales_count} vendas registradas
          </span>
        </KpiCard>

        <KpiCard 
          title="Lucro Bruto" 
          value={`R$ ${(totals.revenue - totals.cost).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={<TrendingUp className="text-green-600" size={24} />}
        >
          <span className={`text-xs font-medium ${grossMargin > 30 ? 'text-green-600' : 'text-yellow-600'}`}>
            Margem: {grossMargin.toFixed(1)}%
          </span>
        </KpiCard>

        <KpiCard 
          title="Metragem Total" 
          value={`${totals.m2.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} m²`}
          icon={<Layers className="text-purple-600" size={24} />}
        >
           <span className="text-xs text-gray-500">
             Ticket Médio: R$ {(totals.revenue / (totals.m2 || 1)).toFixed(2)} / m²
           </span>
        </KpiCard>

        <KpiCard 
          title="Top Material" 
          value={topMaterials[0]?.material || "N/A"}
          icon={<Package className="text-orange-600" size={24} />}
        >
          <span className="text-xs text-gray-500">
            {topMaterials[0] 
              ? `R$ ${topMaterials[0].total_revenue.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} vendidos` 
              : 'Sem dados'}
          </span>
        </KpiCard>
      </div>

      {/* Área Principal: Gráfico e Ranking */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Gráfico de Evolução (Ocupa 2 colunas) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Evolução Financeira</h3>
          <div className="h-80">
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>

        {/* Ranking de Materiais (Ocupa 1 coluna) */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Top Materiais (Receita)</h3>
          <div className="space-y-4 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
            {topMaterials.map((item, index) => (
              <div key={item.material} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className={`
                    w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold
                    ${index === 0 ? 'bg-yellow-100 text-yellow-700' : 
                      index === 1 ? 'bg-gray-200 text-gray-700' : 
                      index === 2 ? 'bg-orange-100 text-orange-700' : 'bg-white border text-gray-500'}
                  `}>
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-800 truncate max-w-[120px]" title={item.material}>
                      {item.material}
                    </p>
                    <p className="text-xs text-gray-500">{item.total_m2.toFixed(1)} m²</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-700">
                    R$ {(item.total_revenue / 1000).toFixed(1)}k
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}