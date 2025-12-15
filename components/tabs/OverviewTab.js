"use client";

import { useState, useMemo, useEffect } from 'react';
import { TrendingUp, Truck, DollarSign, ShoppingBag, Gem, Package, Layers, Calendar } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export default function OverviewTab({ summary, topMaterials, settings, expenses }) {
  
  const monthOptions = useMemo(() => {
    if (!summary || summary.length === 0) return [];
    const options = summary.map(item => {
      const date = new Date(item.year, item.month - 1, 1);
      return { id: item.month_key, label: date.toLocaleString('pt-BR', { month: 'short', year: 'numeric' }).toUpperCase(), ts: date.getTime(), year: item.year, month: item.month };
    });
    const unique = []; const seen = new Set();
    options.sort((a, b) => a.ts - b.ts).forEach(opt => { if(!seen.has(opt.id)) { seen.add(opt.id); unique.push(opt); } });
    return unique;
  }, [summary]);

  const [startMonth, setStartMonth] = useState('');
  const [endMonth, setEndMonth] = useState('');

  useEffect(() => {
    if (monthOptions.length > 0 && !startMonth) {
      setStartMonth(monthOptions[0].id);
      setEndMonth(monthOptions[monthOptions.length - 1].id);
    }
  }, [monthOptions, startMonth]);

  const filteredData = useMemo(() => {
    if (!startMonth || !endMonth) return [];
    const startTs = monthOptions.find(m => m.id === startMonth)?.ts || 0;
    const endTs = monthOptions.find(m => m.id === endMonth)?.ts || Infinity;
    return summary.filter(item => {
      const itemTs = new Date(item.year, item.month - 1, 1).getTime();
      return itemTs >= startTs && itemTs <= endTs;
    }).sort((a, b) => (a.year - b.year) || (a.month - b.month));
  }, [summary, startMonth, endMonth, monthOptions]);

  // --- CÁLCULOS KPI COMPLETOS ---
  
  // 1. Somatório Base
  const kpis = useMemo(() => {
    return filteredData.reduce((acc, curr) => ({
      netRevenue: acc.netRevenue + (curr.total_net_revenue || 0),
      freight: acc.freight + (curr.total_freight || 0),
      cost: acc.cost + (curr.total_cost || 0),
      salesCount: acc.salesCount + (curr.total_sales || 0),
      m2Total: acc.m2Total + (curr.total_m2 || 0),
      m2High: acc.m2High + (curr.total_m2_high || 0),
      m2Low: acc.m2Low + (curr.total_m2_low || 0),
    }), { netRevenue: 0, freight: 0, cost: 0, salesCount: 0, m2Total: 0, m2High: 0, m2Low: 0 });
  }, [filteredData]);

  // 2. Taxas e Despesas
  const taxRate = settings?.tax_rate || 0;
  const commRate = settings?.comm_rate || 0;
  
  // Calcula despesas fixas proporcionais ao número de meses filtrados
  // Ex: Se filtrou 3 meses, multiplica a despesa fixa mensal por 3
  const numberOfMonths = filteredData.length || 1; 
  const totalFixedExpenses = (expenses?.filter(e => e.type === 'FIXED').reduce((a, b) => a + Number(b.value), 0) || 0) * numberOfMonths;
  
  // Calcula despesas variáveis apenas dos meses filtrados
  const filteredMonthKeys = new Set(filteredData.map(d => d.month_key));
  const totalVarExpenses = expenses?.filter(e => e.type === 'VARIABLE' && filteredMonthKeys.has(e.month_key)).reduce((a, b) => a + Number(b.value), 0) || 0;

  // 3. Resultados Finais
  const grossRevenue = kpis.netRevenue + kpis.freight; // Venda + Frete
  const taxes = kpis.netRevenue * (taxRate / 100);
  const commissions = kpis.netRevenue * (commRate / 100);
  
  // Lucro Líquido Real (KPI solicitado) = NetRev - Custo - Impostos - Comissões - Despesas
  const realNetProfit = kpis.netRevenue - kpis.cost - taxes - commissions - totalFixedExpenses - totalVarExpenses;

  const avgTicket = kpis.salesCount > 0 ? kpis.netRevenue / kpis.salesCount : 0;

  const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  const formatNum = (val) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);

  const chartData = {
    labels: filteredData.map(item => `${item.month}/${item.year}`),
    datasets: [
      { label: 'Faturamento', data: filteredData.map(item => (item.total_net_revenue || 0) + (item.total_freight || 0)), borderColor: '#0891b2', backgroundColor: 'rgba(8, 145, 178, 0.1)', fill: true, tension: 0.3 },
      { label: 'Custos (CMV)', data: filteredData.map(item => item.total_cost || 0), borderColor: '#ef4444', backgroundColor: 'transparent', borderDash: [5, 5], tension: 0.3 }
    ],
  };

  const materials = topMaterials.map(m => ({ ...m, price_per_m2: m.total_m2 > 0 ? m.total_revenue / m.total_m2 : 0 }));
  const highValue = materials.filter(m => m.price_per_m2 > 300).sort((a,b) => b.total_revenue - a.total_revenue).slice(0, 50);
  const lowValue = materials.filter(m => m.price_per_m2 <= 300).sort((a,b) => b.total_revenue - a.total_revenue).slice(0, 50);

  return (
    <div className="space-y-6 fade-in pb-10">
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2"><Calendar className="text-cyan-600" size={20} /> Painel de Controle</h2>
        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
          <div className="flex flex-col"><label className="text-[10px] font-bold text-slate-500 uppercase">De:</label><select value={startMonth} onChange={(e) => setStartMonth(e.target.value)} className="bg-transparent border-none text-sm font-bold text-slate-700 cursor-pointer focus:ring-0 py-0 pl-0 w-28">{monthOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}</select></div>
          <div className="w-px h-8 bg-slate-300 mx-2"></div>
          <div className="flex flex-col"><label className="text-[10px] font-bold text-slate-500 uppercase">Até:</label><select value={endMonth} onChange={(e) => setEndMonth(e.target.value)} className="bg-transparent border-none text-sm font-bold text-slate-700 cursor-pointer focus:ring-0 py-0 pl-0 w-28">{monthOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}</select></div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 border-l-4 border-l-blue-500">
          <p className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2"><TrendingUp size={14} /> Faturamento Bruto</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{formatBRL(grossRevenue)}</p>
          <span className="text-[10px] text-slate-400 italic">(Vendas + Fretes)</span>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 border-l-4 border-l-orange-400">
          <p className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2"><Truck size={14} /> Fretes (Repasse)</p>
          <p className="text-2xl font-bold text-orange-600 mt-1">{formatBRL(kpis.freight)}</p>
          <span className="text-[10px] text-slate-400 italic">Repassado ao cliente</span>
        </div>
        {/* KPI ATUALIZADO: Lucro Líquido Real (Descontando tudo) */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 border-l-4 border-l-green-500">
          <p className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2"><DollarSign size={14} /> Lucro Líquido Real</p>
          <p className={`text-2xl font-bold mt-1 ${realNetProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatBRL(realNetProfit)}</p>
          <span className="text-[10px] text-slate-400 italic">Liq - Custo - Imp - Despesas</span>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 border-l-4 border-l-purple-500">
          <p className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2"><ShoppingBag size={14} /> Ticket Médio</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{formatBRL(avgTicket)}</p>
          <span className="text-[10px] text-slate-400 italic">Por venda realizada</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <p className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2"><Layers size={14} /> Metragem Total</p>
          <div className="flex items-baseline gap-1 mt-1"><p className="text-xl font-bold text-slate-800">{formatNum(kpis.m2Total)}</p><span className="text-sm text-slate-600 font-medium">m²</span></div>
        </div>
        <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
          <p className="text-xs font-bold text-purple-600 uppercase flex items-center gap-2"><Gem size={14} /> Alto Valor Agregado</p>
          <div className="flex items-baseline gap-1 mt-1"><p className="text-xl font-bold text-purple-900">{formatNum(kpis.m2High)}</p><span className="text-sm text-purple-700 font-medium">m²</span></div>
          <p className="text-[10px] text-purple-400 mt-1">{kpis.m2Total > 0 ? ((kpis.m2High / kpis.m2Total) * 100).toFixed(1) : 0}% do volume</p>
        </div>
        <div className="bg-slate-100 p-4 rounded-xl border border-slate-200">
          <p className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2"><Package size={14} /> Baixo Valor Agregado</p>
          <div className="flex items-baseline gap-1 mt-1"><p className="text-xl font-bold text-slate-700">{formatNum(kpis.m2Low)}</p><span className="text-sm text-slate-500 font-medium">m²</span></div>
          <p className="text-[10px] text-slate-400 mt-1">{kpis.m2Total > 0 ? ((kpis.m2Low / kpis.m2Total) * 100).toFixed(1) : 0}% do volume</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col max-h-[500px]">
          <div className="p-4 border-b border-slate-100 bg-purple-50 shrink-0"><h3 className="font-bold text-purple-800 text-sm flex items-center gap-2"><Gem size={16} /> Ranking Materiais Alto Agregado ({'>'}300)</h3></div>
          <div className="overflow-y-auto custom-scroll flex-grow p-0"><table className="w-full text-sm text-left"><thead className="bg-slate-50 text-slate-500 text-xs uppercase sticky top-0 shadow-sm"><tr><th className="p-2 pl-4">Material</th><th className="p-2 text-right">M²</th><th className="p-2 text-right pr-4">R$ Total</th></tr></thead><tbody className="divide-y divide-slate-50">{highValue.map((item, idx) => (<tr key={idx} className="hover:bg-purple-50/30 transition-colors"><td className="p-2 pl-4 font-bold text-slate-700 truncate max-w-[180px]" title={item.material}>{item.material}</td><td className="p-2 text-right text-xs text-slate-500">{item.total_m2.toFixed(2)}</td><td className="p-2 text-right pr-4 font-bold text-cyan-700">{formatBRL(item.total_revenue)}</td></tr>))}</tbody></table></div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col max-h-[500px]">
          <div className="p-4 border-b border-slate-100 bg-slate-50 shrink-0"><h3 className="font-bold text-slate-700 text-sm flex items-center gap-2"><Package size={16} /> Ranking Materiais Baixo Agregado ({'<'}300)</h3></div>
          <div className="overflow-y-auto custom-scroll flex-grow p-0"><table className="w-full text-sm text-left"><thead className="bg-slate-50 text-slate-500 text-xs uppercase sticky top-0 shadow-sm"><tr><th className="p-2 pl-4">Material</th><th className="p-2 text-right">M²</th><th className="p-2 text-right pr-4">R$ Total</th></tr></thead><tbody className="divide-y divide-slate-50">{lowValue.map((item, idx) => (<tr key={idx} className="hover:bg-slate-50 transition-colors"><td className="p-2 pl-4 font-medium text-slate-600 truncate max-w-[180px]" title={item.material}>{item.material}</td><td className="p-2 text-right text-xs text-slate-500">{item.total_m2.toFixed(2)}</td><td className="p-2 text-right pr-4 font-bold text-slate-700">{formatBRL(item.total_revenue)}</td></tr>))}</tbody></table></div>
        </div>
      </div>

      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
        <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-slate-700 text-sm">Evolução Mensal de Vendas (Período Selecionado)</h3></div>
        <div className="relative h-80"><Line data={chartData} options={{ responsive: true, maintainAspectRatio: false }} /></div>
      </div>
    </div>
  );
}