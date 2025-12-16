"use client";

import { useState, useMemo, useEffect } from 'react';
import { TrendingUp, Users, Package, Wallet, ArrowUpRight, ArrowDownRight, DollarSign, Activity, Calendar, ArrowRight, Loader2 } from 'lucide-react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

// Lista estática para evitar erro de Date/Timezone
const MONTH_NAMES = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

// Helper para garantir números seguros (nunca retorna NaN ou null)
const safeNum = (val) => {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
};

export default function OverviewTab({ summary = [], settings, expenses = [] }) {
  const [startMonth, setStartMonth] = useState('');
  const [endMonth, setEndMonth] = useState('');
  const [isClient, setIsClient] = useState(false);

  // Garante que só renderiza após o cliente montar (previne erro de hidratação)
  useEffect(() => { setIsClient(true); }, []);

  // 1. GERAÇÃO SEGURA DA LISTA DE MESES (Sem new Date)
  const months = useMemo(() => {
    if (!summary || !Array.isArray(summary)) return [];
    
    // Filtra dados sujos
    const cleanData = summary.filter(item => {
        const y = safeNum(item?.year);
        const m = safeNum(item?.month);
        return y > 2000 && m >= 1 && m <= 12;
    });

    return cleanData
      .sort((a, b) => (safeNum(b.year) - safeNum(a.year)) || (safeNum(b.month) - safeNum(a.month)))
      .map(item => {
        const y = safeNum(item.year);
        const m = safeNum(item.month);
        // Usa o array fixo em vez de Date
        const label = `${MONTH_NAMES[m]} de ${y}`;
        
        return {
            key: `${y}-${m}`,
            year: y,
            month: m,
            value: y * 100 + m,
            label: label
        };
      });
  }, [summary]);

  // Inicializa seleção
  useEffect(() => {
    if (months.length > 0 && !startMonth) {
      setStartMonth(months[0].key);
      setEndMonth(months[0].key);
    }
  }, [months, startMonth]);

  // 2. FILTRO DE PERÍODO
  const periodData = useMemo(() => {
    if (!months.length || !startMonth || !endMonth) return [];

    const startItem = months.find(m => m.key === startMonth);
    const endItem = months.find(m => m.key === endMonth);

    if (!startItem || !endItem) return [];

    const minVal = Math.min(startItem.value, endItem.value);
    const maxVal = Math.max(startItem.value, endItem.value);

    // Filtra summary original com segurança
    return (summary || []).filter(item => {
      const val = safeNum(item?.year) * 100 + safeNum(item?.month);
      return val >= minVal && val <= maxVal;
    }).sort((a, b) => (safeNum(a.year) - safeNum(b.year)) || (safeNum(a.month) - safeNum(b.month)));

  }, [summary, startMonth, endMonth, months]);


  // 3. CÁLCULO DE KPIs
  const kpis = useMemo(() => {
    const def = { grossRev: 0, netRev: 0, profit: 0, margin: 0, m2: 0, avgPrice: 0, cmv: 0, taxes: 0, comms: 0, fixedOps: 0, varOps: 0, freight: 0, monthsCount: 0 };
    
    if (!periodData || periodData.length === 0) return def;

    const totals = periodData.reduce((acc, curr) => ({
      netRev: acc.netRev + safeNum(curr.total_net_revenue),
      freight: acc.freight + safeNum(curr.total_freight),
      cmv: acc.cmv + safeNum(curr.total_cost),
      m2: acc.m2 + safeNum(curr.total_m2)
    }), { netRev: 0, freight: 0, cmv: 0, m2: 0 });

    const taxRate = safeNum(settings?.tax_rate);
    const commRate = safeNum(settings?.comm_rate);

    const taxes = totals.netRev * (taxRate / 100);
    const comms = totals.netRev * (commRate / 100);

    const monthsCount = periodData.length;
    const safeExpenses = Array.isArray(expenses) ? expenses : [];
    
    const monthlyFixedCost = safeExpenses
        .filter(e => e.type === 'FIXED')
        .reduce((acc, curr) => acc + safeNum(curr.value), 0);
    
    const totalFixedOps = monthlyFixedCost * monthsCount;

    const validMonthKeys = new Set(periodData.map(d => `${d.year}-${d.month}`));
    const totalVarOps = safeExpenses
        .filter(e => e.type === 'VARIABLE' && validMonthKeys.has(e.month_key))
        .reduce((acc, curr) => acc + safeNum(curr.value), 0);

    const grossRev = totals.netRev + totals.freight;
    const profit = totals.netRev - totals.cmv - taxes - comms - totalFixedOps - totalVarOps;
    const margin = totals.netRev > 0 ? (profit / totals.netRev) * 100 : 0;
    const avgPrice = totals.m2 > 0 ? totals.netRev / totals.m2 : 0;

    return { 
      grossRev, netRev, profit, margin, m2, avgPrice, 
      cmv: totals.cmv, taxes, comms, fixedOps: totalFixedOps, varOps: totalVarOps, freight: totals.freight, monthsCount
    };
  }, [periodData, settings, expenses]);


  // 4. GRÁFICOS
  const chartDataRaw = useMemo(() => {
    const safeExpenses = Array.isArray(expenses) ? expenses : [];
    
    return {
      labels: periodData.map(d => `${d.month}/${d.year}`), // Label simples
      revenues: periodData.map(d => safeNum(d.total_net_revenue) + safeNum(d.total_freight)),
      profits: periodData.map(d => {
         const net = safeNum(d.total_net_revenue);
         const cost = safeNum(d.total_cost);
         const tax = net * (safeNum(settings?.tax_rate)/100);
         const comm = net * (safeNum(settings?.comm_rate)/100);
         const fixed = safeExpenses.filter(e => e.type === 'FIXED').reduce((a,b)=>a+safeNum(b.value),0);
         const variable = safeExpenses
            .filter(e => e.type === 'VARIABLE' && e.month_key === `${d.year}-${d.month}`)
            .reduce((a,b)=>a+safeNum(b.value),0);
            
         return net - cost - tax - comm - fixed - variable;
      })
    };
  }, [periodData, settings, expenses]);

  const chartData = {
    labels: chartDataRaw.labels,
    datasets: [
      { label: 'Faturamento Bruto', data: chartDataRaw.revenues, borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: true, tension: 0.4 },
      { label: 'Lucro Líquido', data: chartDataRaw.profits, borderColor: '#22c55e', backgroundColor: 'rgba(34, 197, 94, 0.1)', fill: true, tension: 0.4 }
    ]
  };

  const chartOptions = { responsive: true, interaction: { mode: 'index', intersect: false }, scales: { y: { type: 'linear', beginAtZero: true }, x: { grid: { display: false } } }, plugins: { legend: { position: 'top' } } };

  const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(safeNum(val));
  const formatNum = (val) => new Intl.NumberFormat('pt-BR').format(safeNum(val));

  // RENDERIZAÇÃO SEGURA
  if (!isClient) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-slate-400" /></div>;
  
  if (months.length === 0) {
    return (
        <div className="p-10 text-center text-slate-400 border border-dashed border-slate-300 rounded-xl">
            <p>Nenhum dado financeiro processado.</p>
            <p className="text-xs mt-2">Faça o upload de uma planilha na aba "Dados".</p>
        </div>
    );
  }

  return (
    <div className="space-y-6 fade-in pb-10">
      
      {/* SELETOR */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
         <div>
            <h2 className="text-xl font-bold text-slate-800">Visão Geral</h2>
            <p className="text-xs text-slate-500">
               {kpis.monthsCount > 1 ? `Análise acumulada de ${kpis.monthsCount} meses` : 'Análise mensal detalhada'}
            </p>
         </div>
         <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
            <div className="flex items-center gap-2"><Calendar size={14} className="text-slate-500"/><span className="text-xs font-bold text-slate-500 uppercase">De:</span><select value={startMonth} onChange={(e) => setStartMonth(e.target.value)} className="bg-transparent border-none text-sm font-bold text-slate-700 py-0 pl-1 pr-6 focus:ring-0 cursor-pointer">{months.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}</select></div>
            <ArrowRight size={14} className="text-slate-400"/>
            <div className="flex items-center gap-2"><span className="text-xs font-bold text-slate-500 uppercase">Até:</span><select value={endMonth} onChange={(e) => setEndMonth(e.target.value)} className="bg-transparent border-none text-sm font-bold text-slate-700 py-0 pl-1 pr-6 focus:ring-0 cursor-pointer">{months.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}</select></div>
         </div>
      </div>
      
      {/* CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200"><div className="flex justify-between items-start"><div><p className="text-xs font-bold text-slate-500 uppercase">Faturamento Bruto</p><h3 className="text-2xl font-extrabold text-slate-800 mt-1">{formatBRL(kpis.grossRev)}</h3><div className="mt-2 flex items-center gap-1 text-[10px] text-slate-400"><span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-bold">Nota Fiscal</span><span>(Pedra + Frete)</span></div></div><div className="p-2 bg-blue-50 rounded-lg text-blue-600"><DollarSign size={20} /></div></div></div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200"><div className="flex justify-between items-start"><div><p className="text-xs font-bold text-slate-500 uppercase">Lucro Líquido</p><h3 className={`text-2xl font-extrabold mt-1 ${kpis.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatBRL(kpis.profit)}</h3><div className="mt-2 flex items-center gap-1 text-[10px] text-slate-400"><span className={`${kpis.profit>=0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'} px-1.5 py-0.5 rounded font-bold`}>{kpis.margin.toFixed(1)}%</span><span>Margem Real</span></div></div><div className={`p-2 rounded-lg ${kpis.profit>=0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}><Wallet size={20} /></div></div></div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200"><div className="flex justify-between items-start"><div><p className="text-xs font-bold text-slate-500 uppercase">Volume Total</p><h3 className="text-2xl font-extrabold text-slate-800 mt-1">{formatNum(kpis.m2)} <span className="text-sm font-normal text-slate-500">m²</span></h3><p className="mt-2 text-[10px] text-slate-400">Serrado no período</p></div><div className="p-2 bg-purple-50 rounded-lg text-purple-600"><Package size={20} /></div></div></div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200"><div className="flex justify-between items-start"><div><p className="text-xs font-bold text-slate-500 uppercase">Preço Médio</p><h3 className="text-2xl font-extrabold text-slate-800 mt-1">{formatBRL(kpis.avgPrice)}</h3><div className="mt-2 flex items-center gap-1 text-[10px] text-slate-400"><span className="bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded font-bold">Por m²</span><span>(Venda Líquida)</span></div></div><div className="p-2 bg-orange-50 rounded-lg text-orange-600"><Activity size={20} /></div></div></div>
      </div>

      {/* GRÁFICO */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="font-bold text-slate-700 mb-6 flex items-center gap-2"><TrendingUp size={20} className="text-cyan-600"/> Evolução no Período</h3>
        {periodData.length > 0 ? (<div className="h-80 w-full"><Line data={chartData} options={chartOptions} /></div>) : (<div className="h-40 flex items-center justify-center text-slate-400">Nenhum dado selecionado.</div>)}
      </div>

      {/* DRE */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="font-bold text-slate-700 mb-4 text-sm uppercase border-b border-slate-100 pb-2">Resumo Operacional (Acumulado)</h3>
        <div className="space-y-3 text-sm">
            <div className="flex justify-between font-bold text-slate-800"><span>(+) Faturamento Bruto (Nota)</span><span>{formatBRL(kpis.grossRev)}</span></div>
            <div className="flex justify-between text-slate-500 text-xs pl-4"><span>(-) Fretes (Repasse)</span><span className="text-red-400">- {formatBRL(kpis.freight)}</span></div>
            <div className="flex justify-between font-bold text-blue-700 border-t border-slate-100 pt-2"><span>(=) Receita Líquida (Pedra)</span><span>{formatBRL(kpis.netRev)}</span></div>
            <div className="flex justify-between text-slate-600 pl-4"><span>(-) Custo Mercadoria (CMV)</span><span className="text-red-500">- {formatBRL(kpis.cmv)}</span></div>
            <div className="flex justify-between text-slate-600 pl-4"><span>(-) Impostos & Comissões</span><span className="text-red-500">- {formatBRL(kpis.taxes + kpis.comms)}</span></div>
            <div className="flex justify-between text-slate-600 pl-4"><span>(-) Despesas Fixas (Recorrentes x {kpis.monthsCount})</span><span className="text-red-500">- {formatBRL(kpis.fixedOps)}</span></div>
            {kpis.varOps > 0 && (<div className="flex justify-between text-slate-600 pl-4"><span>(-) Despesas Variáveis (Lançadas)</span><span className="text-red-500">- {formatBRL(kpis.varOps)}</span></div>)}
            <div className={`flex justify-between font-extrabold text-lg pt-3 border-t border-slate-200 mt-2 ${kpis.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}><span>(=) LUCRO LÍQUIDO ACUMULADO</span><span>{formatBRL(kpis.profit)}</span></div>
        </div>
      </div>
    </div>
  );
}