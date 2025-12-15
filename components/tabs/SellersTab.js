"use client";

import { useState, useEffect, useMemo } from 'react';
import { Target, Trophy, Filter, Download, Calendar, DollarSign, List, Truck, Calculator, Loader2 } from 'lucide-react';
import { getSellerDetails, saveSellerGoal } from '@/app/actions';

export default function SellersTab({ sellers = [], settings }) { // Proteção: sellers = [] se vier nulo
  const [selectedSeller, setSelectedSeller] = useState('');
  const [selectedMonthKey, setSelectedMonthKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [detailData, setDetailData] = useState({ sales: [], goal: 0 });
  const [localGoal, setLocalGoal] = useState(0);

  // --- 1. FILTROS (Protegidos) ---
  const sellersList = useMemo(() => {
    if (!sellers || !Array.isArray(sellers)) return [];
    // Filtra nulos e pega nomes únicos
    const names = sellers.filter(s => s && s.seller).map(s => s.seller);
    return [...new Set(names)].sort();
  }, [sellers]);

  const monthOptions = useMemo(() => {
    const opts = []; const today = new Date();
    for(let i=0; i<12; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      opts.push({ key: `${d.getFullYear()}-${d.getMonth() + 1}`, label: d.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }) });
    }
    return opts;
  }, []);

  // Seleciona o primeiro vendedor automaticamente se houver lista
  useEffect(() => {
    if (sellersList.length > 0 && !selectedSeller) setSelectedSeller(sellersList[0]);
    if (monthOptions.length > 0 && !selectedMonthKey) setSelectedMonthKey(monthOptions[0].key);
  }, [sellersList, monthOptions, selectedSeller, selectedMonthKey]);

  // Carrega dados do vendedor selecionado
  useEffect(() => {
    if (!selectedSeller || !selectedMonthKey) return;
    async function loadData() {
      setLoading(true);
      try {
        const [year, month] = selectedMonthKey.split('-').map(Number);
        const result = await getSellerDetails(selectedSeller, month, year);
        setDetailData(result || { sales: [], goal: 0 }); // Proteção contra retorno nulo
        setLocalGoal(result?.goal || 0);
      } catch (error) { 
        console.error(error); 
        setDetailData({ sales: [], goal: 0 }); // Fallback em caso de erro
      } finally { 
        setLoading(false); 
      }
    }
    loadData();
  }, [selectedSeller, selectedMonthKey]);

  const handleSaveGoal = async () => { try { await saveSellerGoal(selectedSeller, selectedMonthKey, localGoal); alert('Meta salva!'); } catch (e) { alert('Erro ao salvar meta.'); } };

  // --- 2. CÁLCULOS (Blindados) ---
  const salesList = detailData?.sales || []; // Garante array

  const totals = useMemo(() => {
    return salesList.reduce((acc, curr) => ({
      netRevenue: acc.netRevenue + Number(curr.revenue || 0),   
      freight: acc.freight + Number(curr.freight || 0),     
      m2: acc.m2 + Number(curr.m2_total || 0)
    }), { netRevenue: 0, freight: 0, m2: 0 });
  }, [salesList]);

  const grossRevenue = totals.netRevenue + totals.freight;
  const avgPrice = totals.m2 > 0 ? totals.netRevenue / totals.m2 : 0;
  
  const commRate = Number(settings?.comm_rate || 3);
  const commission = totals.netRevenue * (commRate / 100);
  
  const goal = Number(localGoal) || 0;
  const progressPct = goal > 0 ? (totals.netRevenue / goal) * 100 : 0;
  const missing = Math.max(0, goal - totals.netRevenue);

  const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  const formatNum = (val) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val || 0);

  return (
    <div className="space-y-6 fade-in pb-20">
      
      {/* SEÇÃO 1: CABEÇALHO */}
      <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row gap-4 items-end">
           {/* Vendedor */}
           <div className="w-full md:w-1/4">
             <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center gap-1"><Filter size={12}/> VENDEDOR</label>
             <select value={selectedSeller} onChange={(e) => setSelectedSeller(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded text-sm font-bold text-slate-800 p-2 focus:ring-slate-500">
               {sellersList.length === 0 && <option value="">Sem vendedores...</option>}
               {sellersList.map(s => <option key={s} value={s}>{s}</option>)}
             </select>
           </div>
           
           {/* Mês */}
           <div className="w-full md:w-1/4">
             <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center gap-1"><Calendar size={12}/> PERÍODO</label>
             <select value={selectedMonthKey} onChange={(e) => setSelectedMonthKey(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded text-sm font-bold text-slate-800 p-2 focus:ring-slate-500">
               {monthOptions.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
             </select>
           </div>

           {/* Meta */}
           <div className="w-full md:w-1/4">
             <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center gap-1"><Target size={12}/> META (R$)</label>
             <div className="flex gap-1">
               <input type="number" value={localGoal} onChange={(e) => setLocalGoal(e.target.value)} onBlur={handleSaveGoal} className="w-full border-slate-300 rounded text-sm font-bold text-slate-800 p-2" />
               <button onClick={handleSaveGoal} className="bg-slate-700 text-white px-3 rounded hover:bg-slate-800" title="Salvar"><Target size={16} /></button>
             </div>
           </div>

           {/* Barra de Progresso */}
           <div className="w-full md:w-1/4 flex flex-col justify-end">
              <div className="flex justify-between text-xs font-bold text-slate-500 mb-1">
                <span>ATINGIMENTO:</span>
                <span className={progressPct >= 100 ? 'text-green-600' : 'text-slate-700'}>{progressPct.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div className={`h-full ${progressPct >= 100 ? 'bg-green-500' : 'bg-blue-600'}`} style={{ width: `${Math.min(100, progressPct)}%` }}></div>
              </div>
              <p className="text-[10px] text-right text-slate-400 mt-1">Faltam: {formatBRL(missing)}</p>
           </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20 text-slate-400"><Loader2 className="animate-spin" size={40} /></div> 
      ) : (
        <>
          {/* SEÇÃO 2: TOTAIS (Resumo) */}
          <div className="bg-slate-800 text-white rounded-lg shadow-md p-4 grid grid-cols-2 md:grid-cols-5 gap-4 divide-x divide-slate-600">
            <div className="px-2">
              <p className="text-[10px] text-slate-300 uppercase font-bold flex items-center gap-1"><DollarSign size={12}/> Venda Líquida</p>
              <p className="text-lg font-bold text-white mt-1">{formatBRL(totals.netRevenue)}</p>
              <p className="text-[9px] text-slate-400">Base Comissão</p>
            </div>
            <div className="px-4">
              <p className="text-[10px] text-slate-300 uppercase font-bold flex items-center gap-1"><Truck size={12}/> Fretes</p>
              <p className="text-lg font-bold text-orange-300 mt-1">{formatBRL(totals.freight)}</p>
              <p className="text-[9px] text-slate-400">Repasse</p>
            </div>
            <div className="px-4">
              <p className="text-[10px] text-slate-300 uppercase font-bold flex items-center gap-1"><Calculator size={12}/> Total Geral</p>
              <p className="text-lg font-bold text-blue-300 mt-1">{formatBRL(grossRevenue)}</p>
              <p className="text-[9px] text-slate-400">Faturamento Bruto</p>
            </div>
            <div className="px-4">
              <p className="text-[10px] text-slate-300 uppercase font-bold">Volume Total</p>
              <p className="text-lg font-bold text-white mt-1">{formatNum(totals.m2)} <span className="text-xs font-normal">m²</span></p>
              <p className="text-[9px] text-slate-400">Preço Médio: {formatBRL(avgPrice)}</p>
            </div>
            <div className="px-4">
              <p className="text-[10px] text-slate-300 uppercase font-bold flex items-center gap-1"><Trophy size={12}/> Comissão ({commRate}%)</p>
              <p className="text-lg font-bold text-green-400 mt-1">{formatBRL(commission)}</p>
              <p className="text-[9px] text-slate-400">Estimada</p>
            </div>
          </div>

          {/* SEÇÃO 3: TABELA DETALHADA */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
            <div className="p-3 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
               <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2"><List size={16}/> Extrato de Vendas</h3>
               <button className="text-xs font-bold text-slate-500 flex items-center gap-1 hover:text-slate-800"><Download size={14}/> Exportar</button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left whitespace-nowrap">
                <thead className="bg-slate-100 text-slate-600 font-bold uppercase border-b border-slate-200">
                   <tr>
                      <th className="p-3 w-24">Data</th>
                      <th className="p-3">Cliente</th>
                      <th className="p-3">Material</th>
                      <th className="p-3 text-center">Chapa</th>
                      <th className="p-3 text-right">M²</th>
                      <th className="p-3 text-right text-blue-700 bg-blue-50/50">Venda (Pedra)</th>
                      <th className="p-3 text-right text-orange-600 bg-orange-50/50">Frete</th>
                      <th className="p-3 text-right font-bold text-slate-800">Total Nota</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                   {salesList.length === 0 ? (
                      <tr><td colSpan="8" className="p-8 text-center text-slate-400">Nenhuma venda encontrada.</td></tr>
                   ) : (
                      salesList
                        .sort((a,b) => new Date(a.date) - new Date(b.date))
                        .map((sale, i) => (
                         <tr key={i} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3">{sale.date ? new Date(sale.date).toLocaleDateString() : '-'}</td>
                            <td className="p-3 font-medium text-slate-800 truncate max-w-[200px]" title={sale.client}>{sale.client || 'Consumidor'}</td>
                            <td className="p-3 truncate max-w-[180px]" title={sale.material}>{sale.material}</td>
                            <td className="p-3 text-center">{sale.chapa || '-'}</td>
                            <td className="p-3 text-right">{formatNum(sale.m2_total)}</td>
                            <td className="p-3 text-right font-medium text-blue-700 bg-blue-50/30">{formatBRL(sale.revenue)}</td>
                            <td className="p-3 text-right text-orange-600 bg-orange-50/30">{Number(sale.freight) > 0 ? formatBRL(sale.freight) : '-'}</td>
                            <td className="p-3 text-right font-bold text-slate-900">{formatBRL(Number(sale.revenue || 0) + Number(sale.freight || 0))}</td>
                         </tr>
                      ))
                   )}
                </tbody>
                {salesList.length > 0 && (
                  <tfoot className="bg-slate-100 font-bold text-slate-800 border-t border-slate-200">
                    <tr>
                       <td colSpan="4" className="p-3 text-right uppercase text-slate-500">Totais do Período:</td>
                       <td className="p-3 text-right">{formatNum(totals.m2)}</td>
                       <td className="p-3 text-right text-blue-800">{formatBRL(totals.netRevenue)}</td>
                       <td className="p-3 text-right text-orange-700">{formatBRL(totals.freight)}</td>
                       <td className="p-3 text-right text-slate-900">{formatBRL(grossRevenue)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}