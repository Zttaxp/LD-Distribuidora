"use client";

import { useState, useEffect, useMemo } from 'react';
import { Trophy, Target, ChevronDown, Loader2 } from 'lucide-react';
import { getSellerDetails, saveSellerGoal } from '@/app/actions';

export default function SellersTab({ sellers, settings }) {
  const [selectedSeller, setSelectedSeller] = useState('');
  const [selectedMonthKey, setSelectedMonthKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [detailData, setDetailData] = useState({ sales: [], goal: 0 });
  const [localGoal, setLocalGoal] = useState(0);
  const [expandedRow, setExpandedRow] = useState(null);

  const sellersList = useMemo(() => [...new Set(sellers.map(s => s.seller))].sort(), [sellers]);

  const monthOptions = useMemo(() => {
    const opts = []; const today = new Date();
    for(let i=0; i<12; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      opts.push({ key: `${d.getFullYear()}-${d.getMonth() + 1}`, label: d.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }) });
    }
    return opts;
  }, []);

  useEffect(() => {
    if (sellersList.length > 0 && !selectedSeller) setSelectedSeller(sellersList[0]);
    if (monthOptions.length > 0 && !selectedMonthKey) setSelectedMonthKey(monthOptions[0].key);
  }, [sellersList, monthOptions, selectedSeller, selectedMonthKey]);

  useEffect(() => {
    if (!selectedSeller || !selectedMonthKey) return;
    async function loadData() {
      setLoading(true);
      try {
        const [year, month] = selectedMonthKey.split('-').map(Number);
        const result = await getSellerDetails(selectedSeller, month, year);
        setDetailData(result);
        setLocalGoal(result.goal);
      } catch (error) { console.error(error); } finally { setLoading(false); }
    }
    loadData();
  }, [selectedSeller, selectedMonthKey]);

  const handleSaveGoal = async () => {
    try { await saveSellerGoal(selectedSeller, selectedMonthKey, localGoal); alert('Meta salva!'); } catch (e) { alert('Erro ao salvar meta'); }
  };

  const toggleDetails = (name) => setExpandedRow(expandedRow === name ? null : name);

  // --- CÁLCULOS AUDITADOS ---
  const totalRev = detailData.sales.reduce((acc, curr) => acc + curr.revenue, 0); // Receita Líquida
  const totalCost = detailData.sales.reduce((acc, curr) => acc + (curr.cost || 0), 0);
  const taxRate = settings?.tax_rate || 0;
  const commRate = settings?.comm_rate || 0;
  
  // Deduz Imposto e Comissão da Venda Individual do Vendedor
  const taxes = totalRev * (taxRate / 100);
  const commission = totalRev * (commRate / 100);
  const realProfit = totalRev - totalCost - taxes - commission;

  const goal = Number(localGoal) || 0;
  const progressPct = goal > 0 ? (totalRev / goal) * 100 : 0;

  const clientAnalysis = useMemo(() => {
    const clients = {};
    detailData.sales.forEach(sale => {
      if (!clients[sale.client]) clients[sale.client] = { name: sale.client, revenue: 0, cost: 0, m2: 0, count: 0, items: [] };
      clients[sale.client].revenue += sale.revenue;
      clients[sale.client].cost += (sale.cost || 0);
      clients[sale.client].m2 += sale.m2_total;
      clients[sale.client].count += 1;
      clients[sale.client].items.push(sale);
    });
    return Object.values(clients).map(c => {
      const cProfit = c.revenue - c.cost - (c.revenue * (taxRate/100)) - (c.revenue * (commRate/100));
      const cMargin = c.revenue > 0 ? (cProfit / c.revenue) * 100 : 0;
      return { ...c, profit: cProfit, margin: cMargin };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [detailData.sales, taxRate, commRate]);

  const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="space-y-6 fade-in pb-10">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="w-full md:w-1/3">
            <label className="block text-xs font-medium text-slate-500 mb-1">Selecione o Vendedor</label>
            <div className="relative">
              <select value={selectedSeller} onChange={(e) => setSelectedSeller(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm font-bold text-cyan-700 appearance-none focus:ring-cyan-500 focus:border-cyan-500 text-slate-900">
                {sellersList.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-3 text-slate-400 pointer-events-none" size={16} />
            </div>
          </div>
          <div className="w-full md:w-1/3">
            <label className="block text-xs font-medium text-slate-500 mb-1">Mês de Referência</label>
            <div className="relative">
              <select value={selectedMonthKey} onChange={(e) => setSelectedMonthKey(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm font-semibold appearance-none text-slate-900">
                {monthOptions.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-3 text-slate-400 pointer-events-none" size={16} />
            </div>
          </div>
          <div className="w-full md:w-1/3 relative">
            <label className="block text-xs font-medium text-slate-500 mb-1">Meta Mensal (R$)</label>
            <div className="flex gap-2">
              <input type="number" value={localGoal} onChange={(e) => setLocalGoal(e.target.value)} onBlur={handleSaveGoal} className="w-full border-slate-300 rounded-lg p-2.5 text-sm font-semibold focus:ring-cyan-500 focus:border-cyan-500 text-slate-900" />
              <button onClick={handleSaveGoal} className="bg-cyan-600 text-white p-2.5 rounded-lg hover:bg-cyan-700 transition-colors" title="Salvar Meta"><Target size={18} /></button>
            </div>
          </div>
        </div>
      </div>

      {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-cyan-600" size={40} /></div> : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 col-span-2">
              <div className="flex justify-between items-center mb-2"><h3 className="font-bold text-slate-700 flex items-center gap-2"><Trophy className="text-yellow-500" size={18} /> Progresso da Meta</h3><span className="text-sm font-bold text-cyan-600">{Math.min(100, progressPct).toFixed(1)}%</span></div>
              <div className="w-full bg-gray-200 rounded-full h-4 mb-2 overflow-hidden"><div className="bg-cyan-600 h-4 rounded-full transition-all duration-1000 ease-out" style={{ width: `${Math.min(100, progressPct)}%` }}></div></div>
              <div className="flex justify-between text-xs text-slate-500"><span>Vendido: <strong className="text-slate-700">{formatBRL(totalRev)}</strong></span><span>Meta: <strong className="text-slate-700">{formatBRL(goal)}</strong></span></div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 border-l-4 border-l-yellow-400 flex flex-col justify-center"><p className="text-xs font-bold text-slate-400 uppercase">Comissão Estimada</p><p className="text-3xl font-bold text-slate-800 mt-1">{formatBRL(commission)}</p><span className="text-[10px] text-slate-400 italic">Base: {commRate}% (Sobre Faturamento)</span></div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 border-l-4 border-l-green-500 flex flex-col justify-center"><p className="text-xs font-bold text-slate-400 uppercase">Lucro Líquido (Real)</p><p className={`text-3xl font-bold mt-1 ${realProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatBRL(realProfit)}</p><span className="text-[10px] text-slate-400 italic">Rec - CMV - Imp - Com</span></div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center"><h3 className="font-bold text-slate-700 text-sm">Ranking de Clientes (Detalhado)</h3><div className="flex gap-2 text-[10px] font-bold uppercase"><span className="px-2 py-1 bg-green-100 text-green-700 rounded">Lucro Positivo</span><span className="px-2 py-1 bg-red-100 text-red-600 rounded">Prejuízo</span></div></div>
            <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-xs"><tr><th className="p-3 text-center w-8"></th><th className="p-3 text-center">#</th><th className="p-3">Cliente</th><th className="p-3 text-center">Itens</th><th className="p-3 text-right">M² Total</th><th className="p-3 text-right">R$ Venda</th><th className="p-3 text-right text-blue-600">Lucro (R$)</th><th className="p-3 text-right text-slate-600">Margem %</th></tr></thead><tbody className="divide-y divide-slate-100">{clientAnalysis.map((client, idx) => (<><tr key={idx} onClick={() => toggleDetails(client.name)} className="cursor-pointer hover:bg-slate-50 border-b border-slate-100 text-xs transition-colors"><td className="p-3 text-center text-slate-400"><ChevronDown size={14} className={`transition-transform ${expandedRow === client.name ? 'rotate-180' : ''}`} /></td><td className="p-3 text-center text-slate-400 font-bold">{idx + 1}º</td><td className="p-3 font-bold text-slate-700 truncate max-w-[200px]" title={client.name}>{client.name}</td><td className="p-3 text-center text-slate-500 font-medium">{client.count}</td><td className="p-3 text-right text-slate-500">{client.m2.toFixed(2)}</td><td className="p-3 text-right font-bold text-slate-700">{formatBRL(client.revenue)}</td><td className={`p-3 text-right font-bold ${client.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatBRL(client.profit)}</td><td className={`p-3 text-right font-bold ${client.margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>{client.margin.toFixed(1)}%</td></tr>{expandedRow === client.name && (<tr className="bg-slate-50 border-b border-slate-200"><td colSpan="8" className="p-0"><div className="pl-12 pr-4 py-3 bg-slate-50 shadow-inner"><table className="w-full text-xs text-left"><thead className="text-slate-400 font-normal border-b border-slate-200"><tr><th className="pb-1 px-2">Data</th><th className="pb-1 px-2">Material</th><th className="pb-1 px-2 text-right">M²</th><th className="pb-1 px-2 text-right">Venda</th><th className="pb-1 px-2 text-right">Lucro Item</th></tr></thead><tbody className="divide-y divide-slate-100">{client.items.map((item, i) => { const itemProfit = item.revenue - (item.cost || 0); return (<tr key={i} className="hover:bg-slate-100"><td className="py-2 px-2 text-slate-500">{new Date(item.date).toLocaleDateString()}</td><td className="py-2 px-2 text-slate-700 font-medium truncate max-w-[200px]">{item.material}</td><td className="py-2 px-2 text-right text-slate-500">{item.m2_total.toFixed(2)}</td><td className="py-2 px-2 text-right text-slate-600">{formatBRL(item.revenue)}</td><td className={`py-2 px-2 text-right ${itemProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatBRL(itemProfit)}</td></tr>); })}</tbody></table></div></td></tr>)}</>))}</tbody></table></div>
          </div>
        </>
      )}
    </div>
  );
}