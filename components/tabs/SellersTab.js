"use client";

import { useState, useEffect, useMemo } from 'react';
import { Trophy, Target, ChevronDown, Loader2, Star, Box, BarChart2, List, Layers, Truck, DollarSign } from 'lucide-react';
import { getSellerDetails, saveSellerGoal } from '@/app/actions';

export default function SellersTab({ sellers, settings }) {
  const [selectedSeller, setSelectedSeller] = useState('');
  const [selectedMonthKey, setSelectedMonthKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [detailData, setDetailData] = useState({ sales: [], goal: 0 });
  const [localGoal, setLocalGoal] = useState(0);
  const [expandedRow, setExpandedRow] = useState(null);

  // --- SELETORES ---
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

  const handleSaveGoal = async () => { try { await saveSellerGoal(selectedSeller, selectedMonthKey, localGoal); alert('Meta salva!'); } catch (e) { alert('Erro'); } };
  const toggleDetails = (name) => setExpandedRow(expandedRow === name ? null : name);

  // --- CÁLCULOS E KPI's (COM A SUA LÓGICA DE NEGÓCIO) ---
  
  // 1. Totais Gerais
  // O 'revenue' que vem do banco já é o valor limpo da pedra (segundo a regra Unit < Bruto)
  // O 'freight' que vem do banco já é a diferença calculada
  const totals = useMemo(() => {
    return detailData.sales.reduce((acc, curr) => ({
      netRevenue: acc.netRevenue + curr.revenue,      // Valor da Pedra (Base para Meta/Comissão)
      freight: acc.freight + (curr.freight || 0),     // Frete (Repasse)
      cost: acc.cost + (curr.cost || 0),              // Custo da Pedra
      m2: acc.m2 + curr.m2_total
    }), { netRevenue: 0, freight: 0, cost: 0, m2: 0 });
  }, [detailData.sales]);

  // Faturamento Bruto = Pedra + Frete (Reconstitui o total da nota)
  const grossRevenue = totals.netRevenue + totals.freight;
  
  // Preço Médio do M² (Sobre o valor da pedra)
  const avgPrice = totals.m2 > 0 ? totals.netRevenue / totals.m2 : 0;

  // 2. Comissões e Lucro
  const taxRate = settings?.tax_rate || 6;
  const commRate = settings?.comm_rate || 3;
  
  // Impostos e Comissão incidem sobre a venda da pedra (netRevenue), não sobre o frete
  const taxes = totals.netRevenue * (taxRate / 100);
  const commission = totals.netRevenue * (commRate / 100);
  
  // Lucro Real = (Venda Pedra - Custo Pedra) - Impostos - Comissões
  // O frete não entra no lucro pois é repasse (entra e sai)
  const realProfit = totals.netRevenue - totals.cost - taxes - commission;
  
  const goal = Number(localGoal) || 0;
  const progressPct = goal > 0 ? (totals.netRevenue / goal) * 100 : 0;

  // 3. Ranking de Materiais (Mix de Produtos)
  const materialsRanking = useMemo(() => {
    const map = {};
    detailData.sales.forEach(sale => {
      const mat = sale.material || 'OUTROS';
      if(!map[mat]) map[mat] = { name: mat, m2: 0, revenue: 0 };
      map[mat].m2 += sale.m2_total;
      map[mat].revenue += sale.revenue;
    });
    return Object.values(map).sort((a,b) => b.revenue - a.revenue);
  }, [detailData.sales]);

  // 4. Análise de Clientes (Pareto e Alto Valor)
  const clientAnalysis = useMemo(() => {
    const clients = {};
    detailData.sales.forEach(sale => {
      if (!clients[sale.client]) clients[sale.client] = { name: sale.client, revenue: 0, cost: 0, m2: 0, m2High: 0, chapas: new Set(), count: 0, items: [] };
      clients[sale.client].revenue += sale.revenue;
      clients[sale.client].cost += (sale.cost || 0);
      clients[sale.client].m2 += sale.m2_total;
      
      // Regra de Alto Valor: Preço/m² > 300
      const priceM2 = sale.m2_total > 0 ? sale.revenue / sale.m2_total : 0;
      if (sale.type === 'HIGH' || priceM2 > 300) clients[sale.client].m2High += sale.m2_total;
      
      if (sale.chapa && sale.chapa !== '-' && sale.chapa !== '') clients[sale.client].chapas.add(sale.chapa);
      clients[sale.client].count += 1;
      clients[sale.client].items.push(sale);
    });
    
    // Ordena por Faturamento (Revenue) para o Pareto Financeiro
    let sorted = Object.values(clients).sort((a, b) => b.revenue - a.revenue); 
    const totalRev = sorted.reduce((sum, c) => sum + c.revenue, 0);
    let accumRev = 0;
    
    return sorted.map(c => {
      const cProfit = c.revenue - c.cost - (c.revenue * (taxRate/100)) - (c.revenue * (commRate/100));
      const cMargin = c.revenue > 0 ? (cProfit / c.revenue) * 100 : 0;
      accumRev += c.revenue;
      const cumulativePct = (accumRev / totalRev) * 100;
      const isPareto80 = cumulativePct <= 80 || (cumulativePct - (c.revenue/totalRev*100)) < 80;
      
      return { 
          ...c, 
          profit: cProfit, 
          margin: cMargin, 
          chapasList: Array.from(c.chapas).slice(0, 5).join(', ') + (c.chapas.size > 5 ? '...' : ''), 
          isPareto80 
      };
    });
  }, [detailData.sales, taxRate, commRate]);

  const topHighValueClients = [...clientAnalysis].sort((a, b) => b.m2High - a.m2High).slice(0, 5);
  const paretoClients = clientAnalysis.filter(c => c.isPareto80);
  
  const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="space-y-6 fade-in pb-10">
      
      {/* 1. SELETORES (Cor do texto corrigida para text-slate-900) */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row gap-4 items-end">
           <div className="w-full md:w-1/3"><label className="block text-xs font-medium text-slate-500 mb-1">Vendedor</label><select value={selectedSeller} onChange={(e) => setSelectedSeller(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-bold text-cyan-700 text-slate-900">{sellersList.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
           <div className="w-full md:w-1/3"><label className="block text-xs font-medium text-slate-500 mb-1">Mês</label><select value={selectedMonthKey} onChange={(e) => setSelectedMonthKey(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-semibold text-slate-900">{monthOptions.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}</select></div>
           <div className="w-full md:w-1/3"><label className="block text-xs font-medium text-slate-500 mb-1">Meta (R$)</label><div className="flex gap-2"><input type="number" value={localGoal} onChange={(e) => setLocalGoal(e.target.value)} onBlur={handleSaveGoal} className="w-full border-slate-300 rounded-lg p-2.5 font-semibold text-slate-900" /><button onClick={handleSaveGoal} className="bg-cyan-600 text-white p-2.5 rounded-lg"><Target size={18} /></button></div></div>
        </div>
      </div>

      {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-cyan-600" size={40} /></div> : (
        <>
          {/* 2. KPI CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Meta */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 col-span-2 md:col-span-1">
              <div className="flex justify-between items-center mb-2"><h3 className="font-bold text-slate-700 flex items-center gap-2 text-xs uppercase"><Trophy className="text-yellow-500" size={16} /> Meta</h3><span className="text-sm font-bold text-cyan-600">{Math.min(100, progressPct).toFixed(1)}%</span></div>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-2"><div className="bg-cyan-600 h-2 rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, progressPct)}%` }}></div></div>
              <div className="flex justify-between text-[10px] text-slate-500"><span>Vend: <strong>{formatBRL(totals.netRevenue)}</strong></span><span>Meta: <strong>{formatBRL(goal)}</strong></span></div>
            </div>

            {/* Faturamento Bruto (Total Nota) */}
            <div className="bg-white p-5 rounded-xl border-l-4 border-l-blue-500 flex flex-col justify-center shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1"><DollarSign size={12}/> Faturamento Bruto</p>
              <p className="text-xl font-bold text-slate-800 mt-1">{formatBRL(grossRevenue)}</p>
              <span className="text-[9px] text-slate-400">Venda ({formatBRL(totals.netRevenue)}) + Frete ({formatBRL(totals.freight)})</span>
            </div>

            {/* Comissão */}
            <div className="bg-white p-5 rounded-xl border-l-4 border-l-yellow-400 flex flex-col justify-center shadow-sm">
               <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1"><Star size={12}/> Comissão ({commRate}%)</p>
               <p className="text-xl font-bold text-slate-800 mt-1">{formatBRL(commission)}</p>
               <span className="text-[9px] text-slate-400">Calculado sobre Venda Líquida</span>
            </div>
            
            {/* Lucro Real */}
            <div className="bg-white p-5 rounded-xl border-l-4 border-l-green-500 flex flex-col justify-center shadow-sm">
               <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1"><Layers size={12}/> Lucro Líq. Real</p>
               <p className={`text-xl font-bold mt-1 ${realProfit>=0?'text-green-700':'text-red-700'}`}>{formatBRL(realProfit)}</p>
            </div>
          </div>

          {/* 3. RANKINGS (PARETO E MIX) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Mix de Produtos */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-[400px]">
               <div className="p-4 border-b border-slate-100 bg-slate-50">
                  <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2"><Layers size={16} className="text-cyan-600"/> Mix de Produtos</h3>
                  <p className="text-[10px] text-slate-500 mt-1">O que foi vendido (Top Materiais)</p>
               </div>
               <div className="overflow-y-auto custom-scroll flex-grow">
                  <table className="w-full text-xs text-left">
                     <thead className="bg-slate-50 text-slate-600 font-semibold sticky top-0"><tr><th className="p-3">Material</th><th className="p-3 text-right">M²</th><th className="p-3 text-right">Venda (R$)</th></tr></thead>
                     <tbody className="divide-y divide-slate-100">
                        {materialsRanking.map((item, idx) => (
                           <tr key={idx} className="hover:bg-slate-50">
                              <td className="p-3 font-medium text-slate-700 truncate max-w-[150px]" title={item.name}>{item.name}</td>
                              <td className="p-3 text-right text-slate-500">{item.m2.toFixed(2)}</td>
                              <td className="p-3 text-right font-bold text-cyan-700">{formatBRL(item.revenue)}</td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </div>

            {/* Pareto de Clientes */}
            <div className="bg-white rounded-xl shadow-sm border border-blue-100 flex flex-col h-[400px]">
              <div className="p-4 border-b border-blue-100 bg-blue-50">
                 <h3 className="font-bold text-blue-800 text-sm flex items-center gap-2"><BarChart2 size={16} /> Curva ABC (Faturamento)</h3>
                 <p className="text-[10px] text-blue-600 mt-1">Clientes que trazem 80% da receita</p>
              </div>
              <div className="overflow-y-auto custom-scroll flex-grow">
                 <table className="w-full text-xs text-left">
                    <thead className="bg-blue-50/50 text-blue-900 font-semibold sticky top-0"><tr><th className="p-3">Cliente (Pareto 80%)</th><th className="p-3 text-right">M²</th><th className="p-3">Chapas</th></tr></thead>
                    <tbody className="divide-y divide-blue-50">
                       {paretoClients.map((client, idx) => (
                          <tr key={idx} className="hover:bg-blue-50/30">
                             <td className="p-3 font-bold text-slate-700 border-l-4 border-blue-400">{client.name}</td>
                             <td className="p-3 text-right font-bold text-slate-700">{client.m2.toFixed(2)}</td>
                             <td className="p-3 text-slate-500 truncate max-w-[120px]" title={client.chapasList}><div className="flex items-center gap-1"><Box size={10} className="text-slate-400" />{client.chapasList || '-'}</div></td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
            </div>
          </div>

          {/* 4. EXTRATO DETALHADO (CONFERÊNCIA) */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 mt-6">
             <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                <div>
                   <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2"><List size={16}/> Extrato Detalhado de Vendas</h3>
                   <p className="text-[10px] text-slate-500">Lista cronológica para conferência</p>
                </div>
                <div className="text-right">
                   <p className="text-[10px] font-bold text-slate-400 uppercase">Preço Médio (Pedra)</p>
                   <p className="text-sm font-bold text-slate-700">{formatBRL(avgPrice)}/m²</p>
                </div>
             </div>
             <div className="overflow-x-auto max-h-[500px] custom-scroll">
                <table className="w-full text-xs text-left whitespace-nowrap">
                   <thead className="bg-slate-100 text-slate-600 font-bold uppercase sticky top-0">
                      <tr>
                         <th className="p-3">Data</th>
                         <th className="p-3">Cliente</th>
                         <th className="p-3">Material</th>
                         <th className="p-3 text-center">Chapa</th>
                         <th className="p-3 text-right">M²</th>
                         <th className="p-3 text-right text-blue-600" title="Preço Unitário ou Preço Bruto com desconto">Valor Pedra</th>
                         <th className="p-3 text-right text-orange-500" title="Diferença entre Bruto e Unitário">Frete</th>
                         <th className="p-3 text-right text-slate-800" title="Valor Total da Nota">Total Nota</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                      {detailData.sales.sort((a,b) => new Date(b.date) - new Date(a.date)).map((sale, i) => (
                         <tr key={i} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 text-slate-500">{new Date(sale.date).toLocaleDateString()}</td>
                            <td className="p-3 font-medium text-slate-700">{sale.client}</td>
                            <td className="p-3 text-slate-600">{sale.material}</td>
                            <td className="p-3 text-center text-slate-500">{sale.chapa || '-'}</td>
                            <td className="p-3 text-right text-slate-500">{sale.m2_total.toFixed(2)}</td>
                            <td className="p-3 text-right font-bold text-blue-700">{formatBRL(sale.revenue)}</td>
                            <td className="p-3 text-right text-orange-600">{sale.freight > 0 ? formatBRL(sale.freight) : '-'}</td>
                            {/* Soma visual para provar que a conta fecha */}
                            <td className="p-3 text-right font-bold text-slate-800 bg-slate-50/50">{formatBRL(sale.revenue + sale.freight)}</td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>

        </>
      )}
    </div>
  );
}