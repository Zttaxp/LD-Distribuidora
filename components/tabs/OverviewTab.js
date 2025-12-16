"use client";

import { useState, useMemo, useEffect } from 'react';
import { TrendingUp, Users, Package, Wallet, ArrowUpRight, ArrowDownRight, DollarSign, Activity, Calendar, ArrowRight, Loader2 } from 'lucide-react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

export default function OverviewTab({ summary = [], settings, expenses = [] }) {
  const [startMonth, setStartMonth] = useState('');
  const [endMonth, setEndMonth] = useState('');
  const [isClient, setIsClient] = useState(false);

  // Evita erro de hidratação (renderiza apenas no cliente)
  useEffect(() => { setIsClient(true); }, []);

  // 1. GERAÇÃO SEGURA DA LISTA DE MESES
  const months = useMemo(() => {
    if (!summary || !Array.isArray(summary)) return [];
    
    // Filtra apenas itens que tenham Ano e Mês válidos
    const validItems = summary.filter(item => {
        const y = Number(item?.year);
        const m = Number(item?.month);
        return !isNaN(y) && !isNaN(m) && y > 2000 && m >= 1 && m <= 12;
    });
    
    return validItems
      .sort((a, b) => (Number(b.year) - Number(a.year)) || (Number(b.month) - Number(a.month)))
      .map(item => {
        try {
            // Tenta criar a data com segurança
            const y = Number(item.year);
            const m = Number(item.month);
            const date = new Date(y, m - 1, 1);
            
            // Se der data inválida, retorna um texto genérico
            const label = !isNaN(date.getTime()) 
                ? date.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
                : `${m}/${y}`;

            return {
                key: `${y}-${m}`,
                year: y,
                month: m,
                value: y * 100 + m,
                label: label
            };
        } catch (e) {
            return null;
        }
      })
      .filter(item => item !== null); // Remove qualquer item que tenha dado erro
  }, [summary]);

  // Inicializa seleção
  useEffect(() => {
    if (months.length > 0 && !startMonth) {
      setStartMonth(months[0].key);
      setEndMonth(months[0].key);
    }
  }, [months, startMonth]);

  // 2. FILTRO DE PERÍODO SEGURO
  const periodData = useMemo(() => {
    if (!months || months.length === 0 || !startMonth || !endMonth) return [];

    const startItem = months.find(m => m.key === startMonth);
    const endItem = months.find(m => m.key === endMonth);

    if (!startItem || !endItem) return [];

    const minVal = Math.min(startItem.value, endItem.value);
    const maxVal = Math.max(startItem.value, endItem.value);

    // Filtra summary original com segurança
    return (summary || []).filter(item => {
      const y = Number(item?.year);
      const m = Number(item?.month);
      if (isNaN(y) || isNaN(m)) return false;

      const itemVal = y * 100 + m;
      return itemVal >= minVal && itemVal <= maxVal;
    }).sort((a, b) => (Number(a.year) - Number(b.year)) || (Number(a.month) - Number(b.month)));

  }, [summary, startMonth, endMonth, months]);


  // 3. CÁLCULO DE KPIs (Com verificação de nulidade)
  const kpis = useMemo(() => {
    const def = { grossRev: 0, netRev: 0, profit: 0, margin: 0, m2: 0, avgPrice: 0, cmv: 0, taxes: 0, comms: 0, fixedOps: 0, varOps: 0, freight: 0, monthsCount: 0 };
    
    if (!periodData || periodData.length === 0) return def;

    const totals = periodData.reduce((acc, curr) => ({
      netRev: acc.netRev + Number(curr.total_net_revenue || 0),
      freight: acc.freight + Number(curr.total_freight || 0),
      cmv: acc.cmv + Number(curr.total_cost || 0),
      m2: acc.m2 + Number(curr.total_m2 || 0)
    }), { netRev: 0, freight: 0, cmv: 0, m2: 0 });

    const taxRate = Number(settings?.tax_rate || 0);
    const commRate = Number(settings?.comm_rate || 0);

    const taxes = totals.netRev * (taxRate / 100);
    const comms = totals.netRev * (commRate / 100);

    const monthsCount = periodData.length;
    const safeExpenses = Array.isArray(expenses) ? expenses : [];
    
    const monthlyFixedCost = safeExpenses
        .filter(e => e.type === 'FIXED')
        .reduce((acc, curr) => acc + Number(curr.value || 0), 0);
    
    const totalFixedOps = monthlyFixedCost * monthsCount;

    const validMonthKeys = new Set(periodData.map(d => `${d.year}-${d.month}`));
    const totalVarOps = safeExpenses
        .filter(e => e.type === 'VARIABLE' && validMonthKeys.has(e.month_key))
        .reduce((acc, curr) => acc + Number(curr.value || 0), 0);

    const grossRev = totals.netRev + totals.freight;
    const profit = totals.netRev - totals.cmv - taxes - comms - totalFixedOps - totalVarOps;
    const margin = totals.netRev > 0 ? (profit / totals.netRev) * 100 : 0;
    const avgPrice = totals.m2 > 0 ? totals.netRev / totals.m2 : 0;

    return { 
      grossRev, netRev, profit, margin, m2, avgPrice, 
      cmv: totals.cmv, taxes, comms, fixedOps: totalFixedOps, varOps: totalVarOps, freight: totals.freight, monthsCount
    };
  }, [periodData, settings, expenses]);


  // 4. GRÁFICOS SEGUROS
  const chartDataRaw = useMemo(() => {
    const safeExpenses = Array.isArray(expenses) ? expenses : [];
    
    return {
      labels: periodData.map(d => `${d.month}/${d.year}`),
      revenues: periodData.map(d => Number(d.total_net_revenue || 0) + Number(d.total_freight || 0)),
      profits: periodData.map(d => {
         const net = Number(d.total_net_revenue || 0);
         const cost = Number(d.total_cost || 0);
         const tax = net * (Number(settings?.tax_rate||0)/100);
         const comm = net * (Number(settings?.comm_rate||0)/100);
         const fixed = safeExpenses.filter(e => e.type === 'FIXED').reduce((a,b)=>a+Number(b.value||0),0);
         const variable = safeExpenses
            .filter(e => e.type === 'VARIABLE' && e.month_key === `${d.year}-${d.month}`)
            .reduce((a,b)=>a+Number(b.value||0),0);
            
         return net - cost - tax - comm - fixed - variable;
      })
    };
  }, [periodData, settings, expenses]);

  const chartData = {
    labels: chartDataRaw.labels,
    datasets: [
      { label: 'Faturamento Bruto', data: chartDataRaw.revenues, borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: true, tension: 0.4, yAxisID: 'y' },
      { label: 'Lucro Líquido', data: chartDataRaw.profits, borderColor: '#22c55e', backgroundColor: 'rgba(34, 197, 94, 0.1)', fill: true, tension: 0.4, yAxisID: 'y' }
    ]
  };

  const chartOptions = {
    responsive: true,
    interaction: { mode: 'index', intersect: false },
    scales: { y: { type: 'linear', display: true, position: 'left', grid: { color: '#f1f5f9' } }, x: { grid: { display: false } } },
    plugins: { legend: { position: 'top' } }
  };

  const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(isNaN(val) ? 0 : val);
  const formatNum = (val) => new Intl.NumberFormat('pt-BR').format(isNaN(val) ? 0 : val);

  // PREVENÇÃO DE CRASH NA RENDERIZAÇÃO
  if (!isClient) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-slate-400" /></div>;
  if (!summary || summary.length === 0) return <div className="p-10 text-center text-slate-400">Nenhum dado financeiro disponível.</div>;
  if (months.length === 0) return <div className="p-10 text-center text-slate-400">Dados inválidos encontrados. Verifique a planilha.</div>;

  return (
    <div className="space-y-6 fade-in pb-10">
      
      {/* SELETOR DE PERÍODO */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
         <div>
            <h2 className="text-xl font-bold text-slate-800">Visão Geral</h2>
            <p className="text-xs text-slate-500">
               {kpis.monthsCount > 1 ? `Análise acumulada de ${kpis.monthsCount} meses` : 'Análise mensal detalhada'}
            </p>
         </div>
         
         <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
            <div className="flex items-center gap-2">
               <Calendar size={14} className="text-slate-500"/>
               <span className="text-xs font-bold text-slate-500 uppercase">De:</span>
               <select value={startMonth} onChange={(e) => setStartMonth(e.target.value)} className="bg-transparent border-none text-sm font-bold text-slate-700 py-0 pl-1 pr-6 focus:ring-0 cursor-pointer">
                  {months.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
               </select>
            </div>
            <ArrowRight size={14} className="text-slate-400"/>
            <div className="flex items-center gap-2">
               <span className="text-xs font-bold text-slate-500 uppercase">Até:</span>
               <select value={endMonth} onChange={(e) => setEndMonth(e.target.value)} className="bg-transparent border-none text-sm font-bold text-slate-700 py-0 pl-1 pr-6 focus:ring-0 cursor-pointer">
                  {months.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
               </select>
            </div>
         </div>
      </div>
      
      {/* CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start">
            <div><p className="text-xs font-bold text-slate-500 uppercase">Faturamento Bruto</p><h3 className="text-2xl font-extrabold text-slate-800 mt-1">{formatBRL(kpis.grossRev)}</h3><div className="mt-2 flex items-center gap-1 text-[10px] text-slate-400"><span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-bold">Nota Fiscal</span><span>(Pedra + Frete)</span></div></div>
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><DollarSign size={20} /></div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start">
            <div><p className="text-xs font-bold text-slate-500 uppercase">Lucro Líquido</p><h3 className={`text-2xl font-extrabold mt-1 ${kpis.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatBRL(kpis.profit)}</h3><div className="mt-2 flex items-center gap-1 text-[10px] text-slate-400"><span className={`${kpis.profit>=0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'} px-1.5 py-0.5 rounded font-bold`}>{kpis.margin.toFixed(1)}%</span><span>Margem Real</span></div></div>
            <div className={`p-2 rounded-lg ${kpis.profit>=0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}><Wallet size={20} /></div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start">
            <div><p className="text-xs font-bold text-slate-500 uppercase">Volume Total</p><h3 className="text-2xl font-extrabold text-slate-800 mt-1">{formatNum(kpis.m2)} <span className="text-sm font-normal text-slate-500">m²</span></h3><p className="mt-2 text-[10px] text-slate-400">Serrado no período</p></div>
            <div className="p-2 bg-purple-50 rounded-lg text-purple-600"><Package size={20} /></div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start">
            <div><p className="text-xs font-bold text-slate-500 uppercase">Preço Médio</p><h3 className="text-2xl font-extrabold text-slate-800 mt-1">{formatBRL(kpis.avgPrice)}</h3><div className="mt-2 flex items-center gap-1 text-[10px] text-slate-400"><span className="bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded font-bold">Por m²</span><span>(Venda Líquida)</span></div></div>
            <div className="p-2 bg-orange-50 rounded-lg text-orange-600"><Activity size={20} /></div>
          </div>
        </div>
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