"use client";

import { useState, useMemo, useEffect } from 'react';
import { TrendingUp, Users, Package, Wallet, ArrowUpRight, ArrowDownRight, DollarSign, Activity, Calendar } from 'lucide-react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

export default function OverviewTab({ summary, settings, expenses }) {
  const [selectedMonth, setSelectedMonth] = useState('');

  // 1. Gera as opções de meses disponíveis (baseado no histórico)
  const months = useMemo(() => {
    if (!summary) return [];
    return [...summary]
      .sort((a, b) => (b.year - a.year) || (b.month - a.month))
      .map(item => ({
        key: `${item.year}-${item.month}`,
        label: new Date(item.year, item.month - 1, 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
      }));
  }, [summary]);

  // Seleciona o mês mais recente automaticamente ao carregar
  useEffect(() => {
    if (months.length > 0 && !selectedMonth) setSelectedMonth(months[0].key);
  }, [months, selectedMonth]);

  // 2. Filtra os dados do mês selecionado
  const currentMonthData = useMemo(() => {
    if (!summary || !selectedMonth) return null;
    return summary.find(s => `${s.year}-${s.month}` === selectedMonth);
  }, [summary, selectedMonth]);

  // --- CÁLCULO DOS KPIs (Do Mês Selecionado) ---
  const kpis = useMemo(() => {
    if (!currentMonthData) return { 
        grossRev: 0, netRev: 0, profit: 0, margin: 0, m2: 0, avgPrice: 0 
    };

    const netRev = Number(currentMonthData.total_net_revenue || 0); // Venda Pedra
    const freight = Number(currentMonthData.total_freight || 0);     // Frete
    const cmv = Number(currentMonthData.total_cost || 0);            // Custo Pedra
    const m2 = Number(currentMonthData.total_m2 || 0);

    const taxRate = Number(settings?.tax_rate || 0);
    const commRate = Number(settings?.comm_rate || 0);

    // Deduções Variáveis
    const taxes = netRev * (taxRate / 100);
    const comms = netRev * (commRate / 100);

    // Despesas Fixas (Soma do cadastro de despesas)
    // Nota: Filtra despesas fixas globais. 
    // (Se quiser histórico de despesa fixa, precisaria salvar snapshots mensais, mas aqui usa o cadastro atual como base)
    const fixedOps = expenses
        .filter(e => e.type === 'FIXED')
        .reduce((acc, curr) => acc + Number(curr.value), 0);

    // FÓRMULAS FINAIS (Regra: Pedra vs Frete)
    const grossRev = netRev + freight; // Faturamento Bruto (Nota)
    
    // Lucro Líquido = Venda Liq - CMV - Imposto - Comissão - Fixas
    const profit = netRev - cmv - taxes - comms - fixedOps; 
    
    // Margem Líquida %
    const margin = netRev > 0 ? (profit / netRev) * 100 : 0;
    
    // Preço Médio (Sobre Venda de Pedra)
    const avgPrice = m2 > 0 ? netRev / m2 : 0;

    return { grossRev, netRev, profit, margin, m2, avgPrice };
  }, [currentMonthData, settings, expenses]);


  // --- GRÁFICOS (Evolução Anual) ---
  const historyData = useMemo(() => {
    // Ordena cronologicamente para o gráfico
    const sorted = [...summary].sort((a, b) => (a.year - b.year) || (a.month - b.month));
    
    return {
      labels: sorted.map(d => `${d.month}/${d.year}`),
      revenues: sorted.map(d => Number(d.total_net_revenue) + Number(d.total_freight)), // Bruto
      profits: sorted.map(d => {
         const net = Number(d.total_net_revenue);
         const cost = Number(d.total_cost);
         const tax = net * (Number(settings?.tax_rate||0)/100);
         const comm = net * (Number(settings?.comm_rate||0)/100);
         const fixed = expenses.filter(e => e.type === 'FIXED').reduce((a,b)=>a+Number(b.value),0);
         return net - cost - tax - comm - fixed;
      })
    };
  }, [summary, settings, expenses]);

  const chartData = {
    labels: historyData.labels,
    datasets: [
      {
        label: 'Faturamento Bruto',
        data: historyData.revenues,
        borderColor: '#3b82f6', // blue-500
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
        yAxisID: 'y'
      },
      {
        label: 'Lucro Líquido',
        data: historyData.profits,
        borderColor: '#22c55e', // green-500
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        fill: true,
        tension: 0.4,
        yAxisID: 'y'
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    interaction: { mode: 'index', intersect: false },
    scales: {
      y: { type: 'linear', display: true, position: 'left', grid: { color: '#f1f5f9' } },
      x: { grid: { display: false } }
    },
    plugins: { legend: { position: 'top' } }
  };

  const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  const formatNum = (val) => new Intl.NumberFormat('pt-BR').format(val || 0);

  return (
    <div className="space-y-6 fade-in pb-10">
      
      {/* CABEÇALHO COM SELETOR */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center">
         <div>
            <h2 className="text-xl font-bold text-slate-800">Visão Geral</h2>
            <p className="text-xs text-slate-500">Acompanhamento dos principais indicadores</p>
         </div>
         <div className="flex items-center gap-2">
            <Calendar size={16} className="text-slate-500"/>
            <select 
               value={selectedMonth} 
               onChange={(e) => setSelectedMonth(e.target.value)} 
               className="bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold text-slate-700 p-2 focus:ring-cyan-500 focus:border-cyan-500"
            >
               {months.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
         </div>
      </div>
      
      {/* SEÇÃO 1: CARDS DE KPI (MÊS SELECIONADO) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        
        {/* Faturamento */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 transition-transform hover:scale-[1.02] duration-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase">Faturamento Bruto</p>
              <h3 className="text-2xl font-extrabold text-slate-800 mt-1">{formatBRL(kpis.grossRev)}</h3>
              <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-400">
                <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-bold">Nota Fiscal</span>
                <span>(Pedra + Frete)</span>
              </div>
            </div>
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><DollarSign size={20} /></div>
          </div>
        </div>

        {/* Lucro Líquido */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 transition-transform hover:scale-[1.02] duration-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase">Lucro Líquido</p>
              <h3 className={`text-2xl font-extrabold mt-1 ${kpis.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatBRL(kpis.profit)}</h3>
              <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-400">
                <span className={`${kpis.profit>=0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'} px-1.5 py-0.5 rounded font-bold`}>{kpis.margin.toFixed(1)}%</span>
                <span>Margem Real</span>
              </div>
            </div>
            <div className={`p-2 rounded-lg ${kpis.profit>=0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}><Wallet size={20} /></div>
          </div>
        </div>

        {/* Volume */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 transition-transform hover:scale-[1.02] duration-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase">Volume Vendido</p>
              <h3 className="text-2xl font-extrabold text-slate-800 mt-1">{formatNum(kpis.m2)} <span className="text-sm font-normal text-slate-500">m²</span></h3>
              <p className="mt-2 text-[10px] text-slate-400">Metragem serrada</p>
            </div>
            <div className="p-2 bg-purple-50 rounded-lg text-purple-600"><Package size={20} /></div>
          </div>
        </div>

        {/* Preço Médio */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 transition-transform hover:scale-[1.02] duration-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase">Preço Médio</p>
              <h3 className="text-2xl font-extrabold text-slate-800 mt-1">{formatBRL(kpis.avgPrice)}</h3>
              <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-400">
                <span className="bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded font-bold">Por m²</span>
                <span>(Venda Líquida)</span>
              </div>
            </div>
            <div className="p-2 bg-orange-50 rounded-lg text-orange-600"><Activity size={20} /></div>
          </div>
        </div>
      </div>

      {/* SEÇÃO 2: GRÁFICO HISTÓRICO */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="font-bold text-slate-700 mb-6 flex items-center gap-2"><TrendingUp size={20} className="text-cyan-600"/> Evolução Financeira (Histórico)</h3>
        <div className="h-80 w-full">
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>

      {/* SEÇÃO 3: EXTRATO RÁPIDO DRE (MÊS SELECIONADO) */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="font-bold text-slate-700 mb-4 text-sm uppercase border-b border-slate-100 pb-2">Resumo Operacional ({months.find(m => m.key === selectedMonth)?.label})</h3>
        <div className="space-y-3 text-sm">
            <div className="flex justify-between font-bold text-slate-800">
                <span>(+) Faturamento Bruto (Nota)</span>
                <span>{formatBRL(kpis.grossRev)}</span>
            </div>
            <div className="flex justify-between text-slate-500 text-xs pl-4">
                <span>(-) Fretes (Repasse)</span>
                <span className="text-red-400">- {formatBRL(kpis.grossRev - kpis.netRev)}</span>
            </div>
            <div className="flex justify-between font-bold text-blue-700 border-t border-slate-100 pt-2">
                <span>(=) Receita Líquida (Pedra)</span>
                <span>{formatBRL(kpis.netRev)}</span>
            </div>
            <div className="flex justify-between text-slate-600 pl-4">
                <span>(-) Custo Mercadoria (CMV)</span>
                <span className="text-red-500">- {formatBRL(Number(currentMonthData?.total_cost || 0))}</span>
            </div>
            <div className="flex justify-between text-slate-600 pl-4">
                <span>(-) Impostos & Comissões</span>
                <span className="text-red-500">- {formatBRL((kpis.netRev * (settings.tax_rate/100)) + (kpis.netRev * (settings.comm_rate/100)))}</span>
            </div>
            <div className="flex justify-between text-slate-600 pl-4">
                <span>(-) Despesas Fixas Operacionais</span>
                <span className="text-red-500">- {formatBRL(expenses.filter(e => e.type === 'FIXED').reduce((a,b)=>a+Number(b.value),0))}</span>
            </div>
            <div className={`flex justify-between font-extrabold text-lg pt-3 border-t border-slate-200 mt-2 ${kpis.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                <span>(=) LUCRO LÍQUIDO FINAL</span>
                <span>{formatBRL(kpis.profit)}</span>
            </div>
        </div>
      </div>
    </div>
  );
}