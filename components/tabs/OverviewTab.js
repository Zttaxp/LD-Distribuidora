"use client";

import { useState, useMemo, useEffect } from 'react';
import { TrendingUp, Users, Package, Wallet, DollarSign, Activity, Calendar, Loader2, Layers, Gem, ArrowRight, Filter } from 'lucide-react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { getMonthlySalesData } from '@/app/actions';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

const MONTH_NAMES = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export default function OverviewTab({ summary = [], settings, expenses = [] }) {
  // --- ESTADOS DE CONTROLE ---
  const [viewMode, setViewMode] = useState('MONTH'); // 'MONTH' ou 'PERIOD'
  const [selectedMonth, setSelectedMonth] = useState('');
  const [startMonth, setStartMonth] = useState('');
  const [endMonth, setEndMonth] = useState('');
  
  const [isMounted, setIsMounted] = useState(false);
  const [rawSales, setRawSales] = useState([]);
  const [loadingSales, setLoadingSales] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  // 1. LISTA DE MESES DISPONÍVEIS
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
        value: Number(item.year) * 100 + Number(item.month), // Valor para comparação de período
        original: item
      }));
  }, [summary]);

  // Inicializa seletores
  useEffect(() => {
    if (months.length > 0) {
      if (!selectedMonth) setSelectedMonth(months[0].key);
      if (!startMonth) setStartMonth(months[months.length - 1].key); // Começa do mais antigo
      if (!endMonth) setEndMonth(months[0].key); // Até o mais novo
    }
  }, [months, selectedMonth, startMonth, endMonth]);

  // 2. LÓGICA DE FILTRAGEM (MÊS vs PERÍODO)
  const targetMonthsKeys = useMemo(() => {
    if (!months.length) return [];

    if (viewMode === 'MONTH') {
      return selectedMonth ? [selectedMonth] : [];
    } else {
      // Modo Período: Encontra todos os meses entre Start e End
      if (!startMonth || !endMonth) return [];
      
      const startItem = months.find(m => m.key === startMonth);
      const endItem = months.find(m => m.key === endMonth);
      
      if (!startItem || !endItem) return [];

      const minVal = Math.min(startItem.value, endItem.value);
      const maxVal = Math.max(startItem.value, endItem.value);

      return months
        .filter(m => m.value >= minVal && m.value <= maxVal)
        .map(m => m.key);
    }
  }, [viewMode, selectedMonth, startMonth, endMonth, months]);

  // 3. BUSCA DE VENDAS (Suporta Múltiplos Meses)
  useEffect(() => {
    if (targetMonthsKeys.length === 0) return;

    async function fetchAllData() {
        setLoadingSales(true);
        try {
            // Busca dados de TODOS os meses selecionados em paralelo
            const promises = targetMonthsKeys.map(key => {
                const [yearStr, monthStr] = key.split('-');
                return getMonthlySalesData(monthStr, yearStr);
            });

            const results = await Promise.all(promises);
            // Junta todas as listas de vendas em uma só
            const allSales = results.flat();
            setRawSales(allSales || []);
        } catch (error) {
            console.error("Erro ao carregar período:", error);
            setRawSales([]);
        } finally {
            setLoadingSales(false);
        }
    }

    fetchAllData();
  }, [targetMonthsKeys]);

  // 4. RANKING DE MATERIAIS (Agregado)
  const materialsRanking = useMemo(() => {
    if (!rawSales || rawSales.length === 0) return { high: [], low: [] };

    const grouped = {};

    rawSales.forEach(sale => {
        const mat = (sale.material || 'OUTROS').trim().toUpperCase();
        if (!grouped[mat]) grouped[mat] = { name: mat, m2: 0, revenue: 0, slabs: 0 };
        
        grouped[mat].m2 += Number(sale.m2_total || 0);
        grouped[mat].revenue += Number(sale.revenue || 0);
        grouped[mat].slabs += 1;
    });

    const list = Object.values(grouped).map(item => ({
        ...item,
        price: item.m2 > 0 ? item.revenue / item.m2 : 0
    }));

    const high = list.filter(i => i.price > 300).sort((a, b) => b.revenue - a.revenue);
    const low = list.filter(i => i.price <= 300).sort((a, b) => b.revenue - a.revenue);

    return { high, low };
  }, [rawSales]);

  // 5. CÁLCULO DE KPIs (Consolidado)
  const kpis = useMemo(() => {
    // Pega os itens do summary correspondentes aos meses selecionados
    const relevantSummaries = summary.filter(s => targetMonthsKeys.includes(`${s.year}-${s.month}`));
    
    const def = { grossRev: 0, netRev: 0, profit: 0, margin: 0, m2: 0, avgPrice: 0, cmv: 0, freight: 0, taxes: 0, comms: 0, fixedOps: 0, varOps: 0, badDebt: 0, m2High: 0, m2Low: 0 };
    
    if (relevantSummaries.length === 0) return def;

    // Soma tudo
    const totals = relevantSummaries.reduce((acc, curr) => ({
        netRev: acc.netRev + Number(curr.total_net_revenue || 0),
        freight: acc.freight + Number(curr.total_freight || 0),
        cmv: acc.cmv + Number(curr.total_cost || 0),
        m2: acc.m2 + Number(curr.total_m2 || 0),
        m2High: acc.m2High + Number(curr.total_m2_high || 0),
        m2Low: acc.m2Low + Number(curr.total_m2_low || 0),
    }), { netRev: 0, freight: 0, cmv: 0, m2: 0, m2High: 0, m2Low: 0 });

    const safeNum = (val) => Number(val) || 0;
    const taxRate = safeNum(settings?.tax_rate);
    const commRate = safeNum(settings?.comm_rate);
    const badDebtRate = safeNum(settings?.bad_debt_rate);

    const taxes = totals.netRev * (taxRate / 100);
    const comms = totals.netRev * (commRate / 100);
    const badDebt = totals.netRev * (badDebtRate / 100);

    // Despesas
    const safeExpenses = Array.isArray(expenses) ? expenses : [];
    
    // Fixas: Multiplica pelo número de meses no período
    const monthsCount = relevantSummaries.length;
    const monthlyFixed = safeExpenses.filter(e => e.type === 'FIXED').reduce((acc, curr) => acc + safeNum(curr.value), 0);
    const fixedOps = monthlyFixed * monthsCount;

    // Variáveis: Soma apenas as que pertencem aos meses selecionados
    const varOps = safeExpenses
        .filter(e => e.type === 'VARIABLE' && targetMonthsKeys.includes(e.month_key))
        .reduce((acc, curr) => acc + safeNum(curr.value), 0);

    const grossRev = totals.netRev + totals.freight;
    const profit = totals.netRev - totals.cmv - taxes - comms - badDebt - fixedOps - varOps;
    const margin = totals.netRev > 0 ? (profit / totals.netRev) * 100 : 0;
    const avgPrice = totals.m2 > 0 ? totals.netRev / totals.m2 : 0;

    return { 
        ...totals, 
        grossRev, profit, margin, avgPrice, 
        taxes, comms, badDebt, fixedOps, varOps,
        monthsCount 
    };
  }, [summary, targetMonthsKeys, settings, expenses]);

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
    // No gráfico histórico, mostramos sempre todos os meses do período selecionado
    // Se for Mês Único, mostra todo o histórico para contexto
    // Se for Período, mostra a evolução dentro do período (ou todo histórico se preferir)
    // Vamos manter "Todo o Histórico" filtrado pelo período se for viewMode=PERIOD, ou tudo se MONTH
    
    let filteredSummary = summary.filter(item => item && item.year && item.month);
    
    // Se estiver em modo período, filtra o gráfico para focar no período? 
    // Geralmente é melhor ver o contexto. Vamos filtrar apenas se for período para dar zoom.
    if (viewMode === 'PERIOD' && targetMonthsKeys.length > 0) {
        filteredSummary = filteredSummary.filter(s => targetMonthsKeys.includes(`${s.year}-${s.month}`));
    }
    
    const sortedHistory = filteredSummary.sort((a, b) => (Number(a.year) - Number(b.year)) || (Number(a.month) - Number(b.month)));
    
    const safeExpenses = Array.isArray(expenses) ? expenses : [];

    const labels = sortedHistory.map(d => `${d.month}/${d.year}`);
    const revenues = sortedHistory.map(d => (Number(d.total_net_revenue)||0) + (Number(d.total_freight)||0));
    
    const profits = sortedHistory.map(d => {
        const net = Number(d.total_net_revenue)||0;
        const cost = Number(d.total_cost)||0;
        const tax = net * ((Number(settings?.tax_rate)||0)/100);
        const comm = net * ((Number(settings?.comm_rate)||0)/100);
        const bDebt = net * ((Number(settings?.bad_debt_rate)||0)/100);
        
        const fixed = safeExpenses.filter(e => e.type === 'FIXED').reduce((acc, curr) => acc + (Number(curr.value)||0), 0);
        const variable = safeExpenses.filter(e => e.type === 'VARIABLE' && e.month_key === `${d.year}-${d.month}`).reduce((acc, curr) => acc + (Number(curr.value)||0), 0);
        
        return net - cost - tax - comm - bDebt - fixed - variable;
    });

    return {
      labels,
      datasets: [
        { label: 'Fat. Bruto', data: revenues, borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: true, tension: 0.3 },
        { label: 'Lucro Líq.', data: profits, borderColor: '#22c55e', backgroundColor: 'rgba(34, 197, 94, 0.1)', fill: true, tension: 0.3 }
      ]
    };
  }, [summary, settings, expenses, viewMode, targetMonthsKeys]);

  const chartOptions = { responsive: true, interaction: { mode: 'index', intersect: false }, scales: { y: { beginAtZero: true, grid: { color: '#f1f5f9' } }, x: { grid: { display: false } } }, plugins: { legend: { display: false } } };
  const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  const formatNum = (val) => new Intl.NumberFormat('pt-BR').format(val || 0);
  const formatPct = (val) => `${(val || 0).toFixed(1)}%`;

  if (!isMounted) return <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-slate-300" /></div>;
  if (months.length === 0) return <div className="p-10 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">Nenhum dado financeiro. Faça upload da planilha.</div>;

  return (
    <div className="space-y-6 fade-in pb-10">
      
      {/* HEADER CONTROLS */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
         <div>
            <h2 className="text-xl font-bold text-slate-800">Visão Geral</h2>
            <p className="text-xs text-slate-500">
                {viewMode === 'MONTH' 
                    ? 'Análise pontual de um único mês' 
                    : `Análise consolidada de ${kpis.monthsCount || 0} meses`}
            </p>
         </div>
         
         <div className="flex flex-col sm:flex-row items-center gap-3">
             {/* TOGGLE MÊS / PERÍODO */}
             <div className="bg-slate-100 p-1 rounded-lg flex text-xs font-bold">
                 <button 
                    onClick={() => setViewMode('MONTH')}
                    className={`px-3 py-1.5 rounded-md transition-all ${viewMode === 'MONTH' ? 'bg-white text-cyan-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                 >
                    Mês Único
                 </button>
                 <button 
                    onClick={() => setViewMode('PERIOD')}
                    className={`px-3 py-1.5 rounded-md transition-all ${viewMode === 'PERIOD' ? 'bg-white text-cyan-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                 >
                    Período
                 </button>
             </div>

             {/* SELETORES */}
             <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                <Calendar size={16} className="text-slate-500"/>
                
                {viewMode === 'MONTH' ? (
                    <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-transparent border-none text-sm font-bold text-slate-700 focus:ring-0 cursor-pointer py-0">
                       {months.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                    </select>
                ) : (
                    <div className="flex items-center gap-2">
                        <select value={startMonth} onChange={(e) => setStartMonth(e.target.value)} className="bg-transparent border-none text-xs font-bold text-slate-700 focus:ring-0 cursor-pointer py-0 w-24">
                           {months.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                        </select>
                        <ArrowRight size={12} className="text-slate-400"/>
                        <select value={endMonth} onChange={(e) => setEndMonth(e.target.value)} className="bg-transparent border-none text-xs font-bold text-slate-700 focus:ring-0 cursor-pointer py-0 w-24">
                           {months.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                        </select>
                    </div>
                )}
             </div>
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
          <p className="mt-2 text-[10px] text-slate-400">{viewMode === 'PERIOD' ? 'Acumulado no Período' : 'Total Serrado'}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <p className="text-xs font-bold text-slate-500 uppercase">Preço Médio</p>
          <h3 className="text-2xl font-extrabold text-slate-800 mt-1">{formatBRL(kpis.avgPrice)}</h3>
          <div className="mt-2 text-[10px] text-slate-400 bg-orange-50 text-orange-700 px-2 py-1 rounded w-fit font-bold">Por m² (Pedra)</div>
        </div>
      </div>

      {/* --- MIX & GRÁFICO --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="font-bold text-slate-700 mb-6 flex items-center gap-2"><TrendingUp size={20} className="text-cyan-600"/> Evolução Financeira</h3>
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
                        <thead className="text-purple-400 font-semibold bg-purple-50 sticky top-0"><tr><th className="p-2 pl-3">Material</th><th className="p-2 text-center">Chapas</th><th className="p-2 text-right">M²</th><th className="p-2 text-right pr-3">Venda Total</th></tr></thead>
                        <tbody className="divide-y divide-purple-50">
                            {materialsRanking.high.length === 0 ? <tr><td colSpan="4" className="p-4 text-center text-slate-400">Sem vendas no período</td></tr> : 
                                materialsRanking.high.map((m, i) => (
                                    <tr key={i} className="hover:bg-purple-50/50">
                                        <td className="p-2 pl-3 font-medium text-slate-700">{m.name}</td>
                                        <td className="p-2 text-center text-slate-500 font-bold">{m.slabs}</td>
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
                        <thead className="text-orange-400 font-semibold bg-orange-50 sticky top-0"><tr><th className="p-2 pl-3">Material</th><th className="p-2 text-center">Chapas</th><th className="p-2 text-right">M²</th><th className="p-2 text-right pr-3">Venda Total</th></tr></thead>
                        <tbody className="divide-y divide-orange-50">
                            {materialsRanking.low.length === 0 ? <tr><td colSpan="4" className="p-4 text-center text-slate-400">Sem vendas no período</td></tr> : 
                                materialsRanking.low.map((m, i) => (
                                    <tr key={i} className="hover:bg-orange-50/50">
                                        <td className="p-2 pl-3 font-medium text-slate-700">{m.name}</td>
                                        <td className="p-2 text-center text-slate-500 font-bold">{m.slabs}</td>
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
        <h3 className="font-bold text-slate-700 mb-4 text-sm uppercase border-b border-slate-100 pb-2">Resumo Operacional ({viewMode === 'MONTH' ? months.find(m => m.key === selectedMonth)?.label : 'Consolidado do Período'})</h3>
        <div className="space-y-3 text-sm">
            <div className="flex justify-between font-bold text-slate-800"><span>(+) Total Nota Fiscal</span><span>{formatBRL(kpis.grossRev)}</span></div>
            <div className="flex justify-between text-slate-500 text-xs pl-4"><span>(-) Fretes (Repasse)</span><span className="text-red-400">- {formatBRL(kpis.freight)}</span></div>
            <div className="flex justify-between font-bold text-blue-700 border-t border-slate-100 pt-2"><span>(=) Receita Líquida (Pedra)</span><span>{formatBRL(kpis.netRev)}</span></div>
            <div className="flex justify-between text-slate-600 pl-4"><span>(-) Custo Mercadoria (CMV)</span><span className="text-red-500">- {formatBRL(kpis.cmv)}</span></div>
            <div className="flex justify-between text-slate-600 pl-4"><span>(-) Impostos & Comissões</span><span className="text-red-500">- {formatBRL(kpis.taxes + kpis.comms)}</span></div>
            {kpis.badDebt > 0 && <div className="flex justify-between text-slate-600 pl-4"><span>(-) Inadimplência Estimada</span><span className="text-red-500">- {formatBRL(kpis.badDebt)}</span></div>}
            <div className="flex justify-between text-slate-600 pl-4"><span>(-) Despesas Fixas {viewMode === 'PERIOD' && `(x ${kpis.monthsCount} meses)`}</span><span className="text-red-500">- {formatBRL(kpis.fixedOps)}</span></div>
            {kpis.varOps > 0 && (<div className="flex justify-between text-slate-600 pl-4"><span>(-) Despesas Variáveis</span><span className="text-red-500">- {formatBRL(kpis.varOps)}</span></div>)}
            <div className={`flex justify-between font-extrabold text-lg pt-3 border-t border-slate-200 mt-2 ${kpis.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}><span>(=) LUCRO LÍQUIDO</span><span>{formatBRL(kpis.profit)}</span></div>
        </div>
      </div>
    </div>
  );
}