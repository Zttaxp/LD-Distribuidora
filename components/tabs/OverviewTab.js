"use client";

import { useState, useMemo, useEffect } from 'react';
import { TrendingUp, Users, Package, Wallet, DollarSign, Activity, Calendar, Loader2, Layers, Gem } from 'lucide-react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js';
// Importamos a função corrigida
import { getMonthlySalesData } from '@/app/actions';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

const MONTH_NAMES = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export default function OverviewTab({ summary = [], settings, expenses = [] }) {
  const [selectedMonth, setSelectedMonth] = useState('');
  const [isMounted, setIsMounted] = useState(false);
  
  // Estado para armazenar as vendas brutas do mês
  const [rawSales, setRawSales] = useState([]);
  const [loadingSales, setLoadingSales] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  // 1. LISTA DE MESES
  const months = useMemo(() => {
    if (!summary || !Array.isArray(summary)) return [];
    return summary
      .filter(item => item && item.year && item.month)
      .sort((a, b) => (Number(b.year) - Number(a.year)) || (Number(b.month) - Number(a.month)))
      .map(item => ({
        key: `${item.year}-${item.month}`,
        label: `${MONTH_NAMES[Number(item.month)]} de ${item.year}`,
        year: Number(item.year),
        month: Number(item.month),
        original: item
      }));
  }, [summary]);

  useEffect(() => {
    if (months.length > 0 && !selectedMonth) setSelectedMonth(months[0].key);
  }, [months, selectedMonth]);

  // 2. BUSCA AS VENDAS (CORRIGIDO: Passando Mês e Ano separados)
  useEffect(() => {
    if (!selectedMonth) return;

    async function fetchData() {
        setLoadingSales(true);
        try {
            // CORREÇÃO: Divide a chave "2025-12" em [2025, 12]
            const [yearStr, monthStr] = selectedMonth.split('-');
            
            // Chama a nova versão da Action passando os dois números
            const sales = await getMonthlySalesData(monthStr, yearStr);
            
            setRawSales(sales || []);
        } catch (error) {
            console.error(error);
            setRawSales([]);
        } finally {
            setLoadingSales(false);
        }
    }
    fetchData();
  }, [selectedMonth]);

  // 3. PROCESSAMENTO DOS RANKINGS (Client-Side)
  const materialsRanking = useMemo(() => {
    // Se não tiver vendas, retorna listas vazias
    if (!rawSales || rawSales.length === 0) return { high: [], low: [] };

    const grouped = {};

    rawSales.forEach(sale => {
        const mat = (sale.material || 'OUTROS').trim().toUpperCase();
        if (!grouped[mat]) grouped[mat] = { name: mat, m2: 0, revenue: 0 };
        
        const m2 = Number(sale.m2_total || 0);
        const rev = Number(sale.revenue || 0);

        grouped[mat].m2 += m2;
        grouped[mat].revenue += rev;
    });

    const list = Object.values(grouped).map(item => ({
        ...item,
        price: item.m2 > 0 ? item.revenue / item.m2 : 0
    }));

    // Separação R$300
    const high = list.filter(i => i.price > 300).sort((a, b) => b.revenue - a.revenue);
    const low = list.filter(i => i.price <= 300).sort((a, b) => b.revenue - a.revenue);

    return { high, low };
  }, [rawSales]);


  // 4. CÁLCULO KPIS GERAIS
  const currentData = useMemo(() => {
    if (!summary || !selectedMonth) return null;
    return summary.find(s => `${s.year}-${s.month}` === selectedMonth);
  }, [summary, selectedMonth]);

  const kpis = useMemo(() => {
    const def = { grossRev: 0, netRev: 0, profit: 0, margin: 0, m2: 0, avgPrice: 0, cmv: 0, freight: 0, taxes: 0, comms: 0, fixedOps: 0, varOps: 0, m2High: 0, m2Low: 0 };
    if (!currentData) return def;

    const safeNum = (val) => Number(val) || 0;

    const netRev = safeNum(currentData.total_net_revenue);
    const freight = safeNum(currentData.total_freight);
    const cmv = safeNum(currentData.total_cost);
    const m2 = safeNum(currentData.total_m2);
    
    // Totais vindos do Summary (Isso já estava funcionando, vide seus prints)
    const m2High = safeNum(currentData.total_m2_high);
    const m2Low = safeNum(currentData.total_m2_low);

    const taxRate = safeNum(settings?.tax_rate);
    const commRate = safeNum(settings?.comm_rate);

    const taxes = netRev * (taxRate / 100);
    const comms = netRev * (commRate / 100);

    const safeExpenses = Array.isArray(expenses) ? expenses : [];
    const fixedOps = safeExpenses.filter(e => e.type === 'FIXED').reduce((acc, curr) => acc + safeNum(curr.value), 0);
    const varOps = safeExpenses.filter(e => e.type === 'VARIABLE' && e.month_key === selectedMonth).reduce((acc, curr) => acc + safeNum(curr.value), 0);

    const grossRev = netRev + freight;
    const profit = netRev - cmv - taxes - comms - fixedOps - varOps;
    const margin = netRev > 0 ? (profit / netRev) * 100 : 0;
    const avgPrice = m2 > 0 ? netRev / m2 : 0;

    return { grossRev, netRev, profit, margin, m2, avgPrice, cmv, freight, taxes, comms, fixedOps, varOps, m2High, m2Low };
  }, [currentData, settings, expenses, selectedMonth]);

  // Gráficos
  const mixChartData = {
    labels: ['Alto Valor (>R$300/m²)', 'Baixo Valor'],
    datasets: [{
      data: [kpis.m2High, kpis.m2Low],
      backgroundColor: ['#8b5cf6', '#f97316'],
      borderWidth: 0
    }]
  };

  const chartData = useMemo(() => {
    const safeExpenses = Array.isArray(expenses) ? expenses : [];
    const sortedHistory = (summary || [])
        .filter(item => item && item.year && item.month)
        .sort((a, b) => (Number(a.year) - Number(b.year)) || (Number(a.month) - Number(b.month)));

    const labels = sortedHistory.map(d => `${d.month}/${d.year}`);
    const revenues = sortedHistory.map(d => (Number(d.total_net_revenue)||0) + (Number(d.total_freight)||0));
    const profits = sortedHistory.map(d => {
        const net = Number(d.total_net_revenue)||0;
        const cost = Number(d.total_cost)||0;
        const tax = net * ((Number(settings?.tax_rate)||0)/100);
        const comm = net * ((Number(settings?.comm_rate)||0)/100);
        const fixed = safeExpenses.filter(e => e.type === 'FIXED').reduce((acc, curr) => acc + (Number(curr.value)||0), 0);
        const variable = safeExpenses.filter(e => e.type === 'VARIABLE' && e.month_key === `${d.year}-${d.month}`).reduce((acc, curr) => acc + (Number(curr.value)||0), 0);
        return net - cost - tax - comm - fixed - variable;
    });

    return {
      labels,
      datasets: [
        { label: 'Fat. Bruto', data: revenues, borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: true, tension: 0.3 },
        { label: 'Lucro Líq.', data: profits, borderColor: '#22c55e', backgroundColor: 'rgba(34, 197, 94, 0.1)', fill: true, tension: 0.3 }
      ]
    };
  }, [summary, settings, expenses]);

  const chartOptions = { responsive: true, interaction: { mode: 'index', intersect: false }, scales: { y: { beginAtZero: true, grid: { color: '#f1f5f9' } }, x: { grid: { display: false } } }, plugins: { legend: { display: false } } };
  const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  const formatNum = (val) => new Intl.NumberFormat('pt-BR').format(val || 0);
  const formatPct = (val) => `${(val || 0).toFixed(1)}%`;

  if (!isMounted) return <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-slate-300" /></div>;
  if (months.length === 0) return <div className="p-10 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">Nenhum dado financeiro. Faça upload da planilha.</div>;

  return (
    <div className="space-y-6 fade-in pb-10">
      
      {/* HEADER */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center">
         <div>
            <h2 className="text-xl font-bold text-slate-800">Visão Geral</h2>
            <p className="text-xs text-slate-500">Indicadores do mês selecionado</p>
         </div>
         <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <Calendar size={16} className="text-slate-500"/>
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-transparent border-none text-sm font-bold text-slate-700 focus:ring-0 cursor-pointer py-0">
               {months.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
         </div>
      </div>
      
      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <p className="text-xs font-bold text-slate-500 uppercase">Faturamento Bruto</p>
          <h3 className="text-2xl font-extrabold text-slate-800 mt-1">{formatBRL(kpis.grossRev)}</h3>
          <div className="mt-2 text-[10px] text-slate-400 bg-blue-50 text-blue-700 px-2 py-1 rounded w-fit font-bold">Nota Fiscal (Pedra + Frete)</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <p className="text-xs font-bold text-slate-500 uppercase">Lucro Líquido</p>
          <h3 className={`text-2xl font-extrabold mt-1 ${kpis.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatBRL(kpis.profit)}</h3>
          <div className="mt-2 text-[10px] text-slate-400 flex items-center gap-2"><span className={`${kpis.profit >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} px-2 py-1 rounded font-bold`}>{kpis.margin.toFixed(1)}%</span><span>Margem Real</span></div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <p className="text-xs font-bold text-slate-500 uppercase">Volume Vendido</p>
          <h3 className="text-2xl font-extrabold text-slate-800 mt-1">{formatNum(kpis.m2)} <span className="text-sm font-normal text-slate-500">m²</span></h3>
          <p className="mt-2 text-[10px] text-slate-400">Total Serrado</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <p className="text-xs font-bold text-slate-500 uppercase">Preço Médio</p>
          <h3 className="text-2xl font-extrabold text-slate-800 mt-1">{formatBRL(kpis.avgPrice)}</h3>
          <div className="mt-2 text-[10px] text-slate-400 bg-orange-50 text-orange-700 px-2 py-1 rounded w-fit font-bold">Por m² (Pedra)</div>
        </div>
      </div>

      {/* --- SEÇÃO MIX DE PRODUTOS --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="font-bold text-slate-700 mb-6 flex items-center gap-2"><TrendingUp size={20} className="text-cyan-600"/> Histórico Financeiro</h3>
            <div className="h-64 w-full"><Line data={chartData} options={chartOptions} /></div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col">
            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Layers size={20} className="text-purple-600"/> Mix de Vendas</h3>
            <div className="flex-grow flex flex-col justify-center items-center">
                <div className="h-40 w-40 relative mb-4">
                     <Doughnut data={mixChartData} options={{ cutout: '70%', plugins: { legend: { display: false } } }} />
                     <div className="absolute inset-0 flex items-center justify-center flex-col">
                        <span className="text-xs text-slate-400 font-bold uppercase">Total</span>
                        <span className="text-lg font-bold text-slate-800">{formatNum(kpis.m2)}</span>
                     </div>
                </div>
                <div className="w-full space-y-2">
                    <div className="flex justify-between items-center text-xs p-2 bg-purple-50 rounded border border-purple-100">
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-purple-500"></div><span className="font-bold text-purple-900">Alto Valor (&gt;300)</span></div>
                        <div className="text-right"><div className="font-bold text-purple-700">{formatNum(kpis.m2High)} m²</div><div className="text-[10px] text-purple-500">{kpis.m2 > 0 ? formatPct((kpis.m2High/kpis.m2)*100) : '0%'}</div></div>
                    </div>
                    <div className="flex justify-between items-center text-xs p-2 bg-orange-50 rounded border border-orange-100">
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-orange-500"></div><span className="font-bold text-orange-900">Baixo Valor</span></div>
                        <div className="text-right"><div className="font-bold text-orange-700">{formatNum(kpis.m2Low)} m²</div><div className="text-[10px] text-orange-500">{kpis.m2 > 0 ? formatPct((kpis.m2Low/kpis.m2)*100) : '0%'}</div></div>
                    </div>
                </div>
            </div>
        </div>
      </div>
      
      {/* RANKING DETALHADO */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         {/* LISTA DE ALTO VALOR */}
         <div className="bg-white p-5 rounded-xl shadow-sm border border-purple-200 flex flex-col h-[400px]">
             <div className="flex justify-between items-center mb-4 border-b border-purple-100 pb-2">
                 <h3 className="font-bold text-purple-800 flex items-center gap-2 text-sm"><Gem size={16}/> Alto Valor (&gt; R$300/m²)</h3>
                 <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">{materialsRanking.high.length} itens</span>
             </div>
             {loadingSales ? (
                <div className="flex-grow flex items-center justify-center"><Loader2 className="animate-spin text-purple-300"/></div>
             ) : (
                <div className="overflow-y-auto custom-scroll flex-grow">
                    <table className="w-full text-xs text-left">
                        <thead className="text-purple-400 font-semibold bg-purple-50 sticky top-0"><tr><th className="p-2 pl-3">Material</th><th className="p-2 text-right">M²</th><th className="p-2 text-right pr-3">Venda Total</th></tr></thead>
                        <tbody className="divide-y divide-purple-50">
                            {materialsRanking.high.length === 0 ? <tr><td colSpan="3" className="p-4 text-center text-slate-400">Sem vendas nesta categoria</td></tr> : 
                                materialsRanking.high.map((m, i) => (
                                    <tr key={i} className="hover:bg-purple-50/50">
                                        <td className="p-2 pl-3 font-medium text-slate-700">{m.name}</td>
                                        <td className="p-2 text-right text-slate-500">{formatNum(m.m2)}</td>
                                        <td className="p-2 text-right pr-3 font-bold text-purple-700">{formatBRL(m.revenue)}</td>
                                    </tr>
                                ))
                            }
                        </tbody>
                    </table>
                </div>
             )}
         </div>

         {/* LISTA DE BAIXO VALOR */}
         <div className="bg-white p-5 rounded-xl shadow-sm border border-orange-200 flex flex-col h-[400px]">
             <div className="flex justify-between items-center mb-4 border-b border-orange-100 pb-2">
                 <h3 className="font-bold text-orange-800 flex items-center gap-2 text-sm"><Layers size={16}/> Baixo Valor (&le; R$300/m²)</h3>
                 <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">{materialsRanking.low.length} itens</span>
             </div>
             {loadingSales ? (
                <div className="flex-grow flex items-center justify-center"><Loader2 className="animate-spin text-orange-300"/></div>
             ) : (
                <div className="overflow-y-auto custom-scroll flex-grow">
                    <table className="w-full text-xs text-left">
                        <thead className="text-orange-400 font-semibold bg-orange-50 sticky top-0"><tr><th className="p-2 pl-3">Material</th><th className="p-2 text-right">M²</th><th className="p-2 text-right pr-3">Venda Total</th></tr></thead>
                        <tbody className="divide-y divide-orange-50">
                            {materialsRanking.low.length === 0 ? <tr><td colSpan="3" className="p-4 text-center text-slate-400">Sem vendas nesta categoria</td></tr> : 
                                materialsRanking.low.map((m, i) => (
                                    <tr key={i} className="hover:bg-orange-50/50">
                                        <td className="p-2 pl-3 font-medium text-slate-700">{m.name}</td>
                                        <td className="p-2 text-right text-slate-500">{formatNum(m.m2)}</td>
                                        <td className="p-2 text-right pr-3 font-bold text-orange-700">{formatBRL(m.revenue)}</td>
                                    </tr>
                                ))
                            }
                        </tbody>
                    </table>
                </div>
             )}
         </div>
      </div>

      {/* DRE SIMPLIFICADO */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="font-bold text-slate-700 mb-4 text-sm uppercase border-b border-slate-100 pb-2">Resumo Operacional ({months.find(m => m.key === selectedMonth)?.label})</h3>
        <div className="space-y-3 text-sm">
            <div className="flex justify-between font-bold text-slate-800"><span>(+) Total Nota Fiscal</span><span>{formatBRL(kpis.grossRev)}</span></div>
            <div className="flex justify-between text-slate-500 text-xs pl-4"><span>(-) Fretes (Repasse)</span><span className="text-red-400">- {formatBRL(kpis.freight)}</span></div>
            <div className="flex justify-between font-bold text-blue-700 border-t border-slate-100 pt-2"><span>(=) Receita Líquida (Pedra)</span><span>{formatBRL(kpis.netRev)}</span></div>
            <div className="flex justify-between text-slate-600 pl-4"><span>(-) Custo Mercadoria (CMV)</span><span className="text-red-500">- {formatBRL(kpis.cmv)}</span></div>
            <div className="flex justify-between text-slate-600 pl-4"><span>(-) Impostos & Comissões</span><span className="text-red-500">- {formatBRL(kpis.taxes + kpis.comms)}</span></div>
            <div className="flex justify-between text-slate-600 pl-4"><span>(-) Despesas Fixas</span><span className="text-red-500">- {formatBRL(kpis.fixedOps)}</span></div>
            {kpis.varOps > 0 && (<div className="flex justify-between text-slate-600 pl-4"><span>(-) Despesas Variáveis</span><span className="text-red-500">- {formatBRL(kpis.varOps)}</span></div>)}
            <div className={`flex justify-between font-extrabold text-lg pt-3 border-t border-slate-200 mt-2 ${kpis.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}><span>(=) LUCRO LÍQUIDO</span><span>{formatBRL(kpis.profit)}</span></div>
        </div>
      </div>
    </div>
  );
}