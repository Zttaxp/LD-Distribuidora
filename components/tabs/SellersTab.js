"use client";

import { useState, useEffect, useMemo } from 'react';
import { Trophy, Target, ChevronDown, Loader2, Star, Box, BarChart2 } from 'lucide-react';
import { getSellerDetails, saveSellerGoal } from '@/app/actions';

export default function SellersTab({ sellers, settings }) {
  // ... (ESTADOS E EFEITOS DE CARREGAMENTO ANTERIORES - MANTIDOS) ...
  const [selectedSeller, setSelectedSeller] = useState('');
  const [selectedMonthKey, setSelectedMonthKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [detailData, setDetailData] = useState({ sales: [], goal: 0 });
  const [localGoal, setLocalGoal] = useState(0);
  const [expandedRow, setExpandedRow] = useState(null);

  // ... (Seletores de Lista - MANTIDOS) ...
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

  // --- CÁLCULOS GERAIS (MANTIDOS) ---
  const totalRev = detailData.sales.reduce((acc, curr) => acc + curr.revenue, 0);
  const totalCost = detailData.sales.reduce((acc, curr) => acc + (curr.cost || 0), 0);
  const taxRate = settings?.tax_rate || 6;
  const commRate = settings?.comm_rate || 3;
  const taxes = totalRev * (taxRate / 100);
  const commission = totalRev * (commRate / 100);
  const realProfit = totalRev - totalCost - taxes - commission;
  const goal = Number(localGoal) || 0;
  const progressPct = goal > 0 ? (totalRev / goal) * 100 : 0;

  // --- AGRUPAMENTO AVANÇADO (PARETO E MIX) ---
  const clientAnalysis = useMemo(() => {
    const clients = {};
    detailData.sales.forEach(sale => {
      if (!clients[sale.client]) {
        clients[sale.client] = { 
          name: sale.client, 
          revenue: 0, 
          cost: 0, 
          m2: 0, 
          m2High: 0, // Novo: m² de alto valor
          chapas: new Set(), // Novo: Lista de chapas únicas
          count: 0, 
          items: [] 
        };
      }
      clients[sale.client].revenue += sale.revenue;
      clients[sale.client].cost += (sale.cost || 0);
      clients[sale.client].m2 += sale.m2_total;
      
      // Checa se é alto valor (>300/m2 ou flag TYPE=HIGH)
      if (sale.type === 'HIGH' || (sale.m2_total > 0 && (sale.revenue/sale.m2_total) > 300)) {
        clients[sale.client].m2High += sale.m2_total;
      }
      
      // Coleta chapa
      if (sale.chapa && sale.chapa !== '-' && sale.chapa !== '') {
         clients[sale.client].chapas.add(sale.chapa);
      }

      clients[sale.client].count += 1;
      clients[sale.client].items.push(sale);
    });

    // Transforma em array e calcula Pareto
    let sorted = Object.values(clients).sort((a, b) => b.m2 - a.m2); // Ordena por Volume Total
    const totalM2Volume = sorted.reduce((sum, c) => sum + c.m2, 0);
    let accumM2 = 0;

    return sorted.map(c => {
      const cProfit = c.revenue - c.cost - (c.revenue * (taxRate/100)) - (c.revenue * (commRate/100));
      const cMargin = c.revenue > 0 ? (cProfit / c.revenue) * 100 : 0;
      
      // Lógica Pareto
      accumM2 += c.m2;
      const cumulativePct = (accumM2 / totalM2Volume) * 100;
      const isPareto80 = cumulativePct <= 80 || (cumulativePct > 80 && (cumulativePct - (c.m2/totalM2Volume*100)) < 80);

      return { 
          ...c, 
          profit: cProfit, 
          margin: cMargin, 
          chapasList: Array.from(c.chapas).slice(0, 5).join(', ') + (c.chapas.size > 5 ? '...' : ''), // Top 5 chapas
          isPareto80
      };
    });
  }, [detailData.sales, taxRate, commRate]);

  // Rankings Derivados
  const topHighValueClients = [...clientAnalysis]
    .sort((a, b) => b.m2High - a.m2High) // Quem compra mais alto valor
    .slice(0, 5); // Top 5

  const paretoClients = clientAnalysis.filter(c => c.isPareto80); // Clientes que fazem 80% do volume

  const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="space-y-6 fade-in pb-10">
      
      {/* 1. SELETORES E INPUT DE META (MANTIDO) */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row gap-4 items-end">
           {/* ... Inputs de Vendedor, Mês e Meta ... */}
           {/* Resumido para brevidade, mantenha o código original dos inputs aqui */}
           <div className="w-full md:w-1/3"><label className="block text-xs font-medium text-slate-500 mb-1">Vendedor</label><select value={selectedSeller} onChange={(e) => setSelectedSeller(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-bold text-cyan-700 text-slate-900">{sellersList.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
           <div className="w-full md:w-1/3"><label className="block text-xs font-medium text-slate-500 mb-1">Mês</label><select value={selectedMonthKey} onChange={(e) => setSelectedMonthKey(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-semibold text-slate-900">{monthOptions.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}</select></div>
           <div className="w-full md:w-1/3"><label className="block text-xs font-medium text-slate-500 mb-1">Meta (R$)</label><div className="flex gap-2"><input type="number" value={localGoal} onChange={(e) => setLocalGoal(e.target.value)} onBlur={handleSaveGoal} className="w-full border-slate-300 rounded-lg p-2.5 font-semibold text-slate-900" /><button onClick={handleSaveGoal} className="bg-cyan-600 text-white p-2.5 rounded-lg"><Target size={18} /></button></div></div>
        </div>
      </div>

      {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-cyan-600" size={40} /></div> : (
        <>
          {/* 2. KPIS GERAIS (MANTIDO) */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 col-span-2">
              <div className="flex justify-between items-center mb-2"><h3 className="font-bold text-slate-700 flex items-center gap-2"><Trophy className="text-yellow-500" size={18} /> Progresso</h3><span className="text-sm font-bold text-cyan-600">{Math.min(100, progressPct).toFixed(1)}%</span></div>
              <div className="w-full bg-gray-200 rounded-full h-4 mb-2"><div className="bg-cyan-600 h-4 rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, progressPct)}%` }}></div></div>
              <div className="flex justify-between text-xs text-slate-500"><span>Vendido: <strong>{formatBRL(totalRev)}</strong></span><span>Meta: <strong>{formatBRL(goal)}</strong></span></div>
            </div>
            {/* ... Cards Comissão e Lucro ... */}
            <div className="bg-white p-6 rounded-xl border-l-4 border-l-yellow-400 flex flex-col justify-center"><p className="text-xs font-bold text-slate-400 uppercase">Comissão</p><p className="text-3xl font-bold text-slate-800 mt-1">{formatBRL(commission)}</p></div>
            <div className="bg-white p-6 rounded-xl border-l-4 border-l-green-500 flex flex-col justify-center"><p className="text-xs font-bold text-slate-400 uppercase">Lucro Real</p><p className={`text-3xl font-bold mt-1 ${realProfit>=0?'text-green-700':'text-red-700'}`}>{formatBRL(realProfit)}</p></div>
          </div>

          {/* 3. NOVA SEÇÃO: INTELIGÊNCIA COMERCIAL (PARETO & MIX) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Tabela Esquerda: Top Compradores Alto Valor */}
            <div className="bg-white rounded-xl shadow-sm border border-purple-100 flex flex-col h-[400px]">
              <div className="p-4 border-b border-purple-100 bg-purple-50">
                 <h3 className="font-bold text-purple-800 text-sm flex items-center gap-2">
                    <Star size={16} /> Top Clientes - Alto Valor Agregado
                 </h3>
                 <p className="text-[10px] text-purple-600 mt-1">Quem compra mais m² de material nobre</p>
              </div>
              <div className="overflow-y-auto custom-scroll flex-grow">
                 <table className="w-full text-xs text-left">
                    <thead className="bg-purple-50/50 text-purple-900 font-semibold sticky top-0">
                       <tr><th className="p-3">Cliente</th><th className="p-3 text-right">M² Alto</th><th className="p-3 text-right">% do Total</th></tr>
                    </thead>
                    <tbody className="divide-y divide-purple-50">
                       {topHighValueClients.filter(c => c.m2High > 0).map((client, idx) => (
                          <tr key={idx}>
                             <td className="p-3 font-medium text-slate-700">{client.name}</td>
                             <td className="p-3 text-right font-bold text-purple-700">{client.m2High.toFixed(2)}</td>
                             <td className="p-3 text-right text-slate-500">{((client.m2High / client.m2)*100).toFixed(0)}%</td>
                          </tr>
                       ))}
                       {topHighValueClients.every(c => c.m2High === 0) && (
                          <tr><td colSpan="3" className="p-6 text-center text-slate-400">Nenhum material de alto valor vendido.</td></tr>
                       )}
                    </tbody>
                 </table>
              </div>
            </div>

            {/* Tabela Direita: Análise de Pareto & Chapas */}
            <div className="bg-white rounded-xl shadow-sm border border-blue-100 flex flex-col h-[400px]">
              <div className="p-4 border-b border-blue-100 bg-blue-50">
                 <h3 className="font-bold text-blue-800 text-sm flex items-center gap-2">
                    <BarChart2 size={16} /> Curva ABC (Volume) & Chapas
                 </h3>
                 <p className="text-[10px] text-blue-600 mt-1">Clientes que representam 80% do volume total (Pareto)</p>
              </div>
              <div className="overflow-y-auto custom-scroll flex-grow">
                 <table className="w-full text-xs text-left">
                    <thead className="bg-blue-50/50 text-blue-900 font-semibold sticky top-0">
                       <tr><th className="p-3">Cliente (Pareto 80%)</th><th className="p-3 text-right">M² Total</th><th className="p-3">Chapas Compradas</th></tr>
                    </thead>
                    <tbody className="divide-y divide-blue-50">
                       {paretoClients.map((client, idx) => (
                          <tr key={idx} className="hover:bg-blue-50/30">
                             <td className="p-3 font-bold text-slate-700 border-l-4 border-blue-400">{client.name}</td>
                             <td className="p-3 text-right font-bold text-slate-700">{client.m2.toFixed(2)}</td>
                             <td className="p-3 text-slate-500 truncate max-w-[150px] flex items-center gap-1" title={client.chapasList}>
                                <Box size={10} className="text-slate-400" />
                                {client.chapasList || 'Várias'}
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
            </div>

          </div>

          {/* 4. TABELA GERAL (MANTIDA EMBAIXO) */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden mt-6">
             <div className="p-4 border-b border-slate-100 bg-slate-50"><h3 className="font-bold text-slate-700 text-sm">Lista Completa</h3></div>
             {/* ... Tabela expansível original ... */}
             <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-xs"><tr><th className="p-3"></th><th className="p-3">Cliente</th><th className="p-3 text-right">M²</th><th className="p-3 text-right">Venda</th><th className="p-3 text-right text-blue-600">Lucro</th></tr></thead><tbody className="divide-y divide-slate-100">{clientAnalysis.map((c, i) => (<tr key={i} onClick={() => toggleDetails(c.name)} className="cursor-pointer hover:bg-slate-50"><td className="p-3 text-center"><ChevronDown size={14}/></td><td className="p-3 font-bold text-slate-700">{c.name}</td><td className="p-3 text-right">{c.m2.toFixed(2)}</td><td className="p-3 text-right">{formatBRL(c.revenue)}</td><td className={`p-3 text-right font-bold ${c.profit>=0?'text-green-600':'text-red-600'}`}>{formatBRL(c.profit)}</td></tr>))}</tbody></table></div>
          </div>
        </>
      )}
    </div>
  );
}