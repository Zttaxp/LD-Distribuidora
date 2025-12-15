"use client";

import { useState, useEffect, useMemo } from 'react';
import { Target, Trophy, Filter, Download, Calendar, DollarSign, List, Truck, Calculator, Loader2, ChevronDown, ChevronRight, Layers } from 'lucide-react';
import { getSellerDetails, saveSellerGoal } from '@/app/actions';

export default function SellersTab({ sellers = [], settings }) {
  const [selectedSeller, setSelectedSeller] = useState('');
  const [selectedMonthKey, setSelectedMonthKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [detailData, setDetailData] = useState({ sales: [], goal: 0 });
  const [localGoal, setLocalGoal] = useState(0);
  
  // Estado para controlar quais clientes estão expandidos (abertos)
  const [expandedClients, setExpandedClients] = useState({});

  // --- 1. FILTROS E CARREGAMENTO ---
  const sellersList = useMemo(() => {
    if (!sellers || !Array.isArray(sellers)) return [];
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
        setDetailData(result || { sales: [], goal: 0 });
        setLocalGoal(result?.goal || 0);
        setExpandedClients({}); // Reseta expansão ao trocar filtro
      } catch (error) { 
        console.error(error); 
        setDetailData({ sales: [], goal: 0 });
      } finally { 
        setLoading(false); 
      }
    }
    loadData();
  }, [selectedSeller, selectedMonthKey]);

  const handleSaveGoal = async () => { try { await saveSellerGoal(selectedSeller, selectedMonthKey, localGoal); alert('Meta salva!'); } catch (e) { alert('Erro ao salvar meta.'); } };
  
  const toggleClient = (clientName) => {
    setExpandedClients(prev => ({ ...prev, [clientName]: !prev[clientName] }));
  };

  // --- 2. CÁLCULOS GERAIS ---
  const salesList = detailData?.sales || [];
  
  // Taxas Globais
  const taxRate = Number(settings?.tax_rate || 6);
  const commRate = Number(settings?.comm_rate || 3);

  const totals = useMemo(() => {
    return salesList.reduce((acc, curr) => ({
      netRevenue: acc.netRevenue + Number(curr.revenue || 0),   
      freight: acc.freight + Number(curr.freight || 0),     
      cost: acc.cost + Number(curr.cost || 0),
      m2: acc.m2 + Number(curr.m2_total || 0)
    }), { netRevenue: 0, freight: 0, cost: 0, m2: 0 });
  }, [salesList]);

  const grossRevenue = totals.netRevenue + totals.freight;
  const avgPrice = totals.m2 > 0 ? totals.netRevenue / totals.m2 : 0;
  const commission = totals.netRevenue * (commRate / 100);
  const totalProfit = totals.netRevenue - totals.cost - (totals.netRevenue * (taxRate/100)) - commission;

  const goal = Number(localGoal) || 0;
  const progressPct = goal > 0 ? (totals.netRevenue / goal) * 100 : 0;
  const missing = Math.max(0, goal - totals.netRevenue);

  // --- 3. AGRUPAMENTO POR CLIENTE ---
  const groupedData = useMemo(() => {
    const groups = {};
    
    salesList.forEach(sale => {
      const client = sale.client || 'Consumidor Final';
      if (!groups[client]) {
        groups[client] = { 
          name: client, 
          items: [],
          totalM2: 0,
          totalRevenue: 0, // Venda Pedra
          totalFreight: 0,
          totalCost: 0,
          totalGross: 0 // Nota
        };
      }
      
      // Cálculos Individuais por Venda (Para exibir na tabela detalhada)
      const sRev = Number(sale.revenue || 0);
      const sCost = Number(sale.cost || 0);
      const sTaxes = sRev * (taxRate / 100);
      const sComm = sRev * (commRate / 100);
      const sProfit = sRev - sCost - sTaxes - sComm;
      // Fórmula solicitada: (Lucro / Custo) * 100
      const sMargin = sCost > 0 ? (sProfit / sCost) * 100 : 0;

      const itemWithCalc = {
        ...sale,
        profit: sProfit,
        margin: sMargin
      };

      groups[client].items.push(itemWithCalc);
      
      // Somatórios do Grupo
      groups[client].totalM2 += Number(sale.m2_total || 0);
      groups[client].totalRevenue += sRev;
      groups[client].totalFreight += Number(sale.freight || 0);
      groups[client].totalCost += sCost;
      groups[client].totalGross += (sRev + Number(sale.freight || 0));
    });

    // Calcula Lucro e Margem do Grupo Inteiro
    return Object.values(groups).map(g => {
        const gTaxes = g.totalRevenue * (taxRate / 100);
        const gComm = g.totalRevenue * (commRate / 100);
        const gProfit = g.totalRevenue - g.totalCost - gTaxes - gComm;
        const gMargin = g.totalCost > 0 ? (gProfit / g.totalCost) * 100 : 0;
        
        return { ...g, profit: gProfit, margin: gMargin };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue); // Ordena por quem comprou mais

  }, [salesList, taxRate, commRate]);


  const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  const formatNum = (val) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val || 0);

  return (
    <div className="space-y-6 fade-in pb-20">
      
      {/* SEÇÃO 1: FILTROS */}
      <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row gap-4 items-end">
           <div className="w-full md:w-1/4">
             <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center gap-1"><Filter size={12}/> VENDEDOR</label>
             <select value={selectedSeller} onChange={(e) => setSelectedSeller(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded text-sm font-bold text-slate-900 p-2 focus:ring-slate-500">
               {sellersList.length === 0 && <option value="">Sem vendedores...</option>}
               {sellersList.map(s => <option key={s} value={s}>{s}</option>)}
             </select>
           </div>
           <div className="w-full md:w-1/4">
             <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center gap-1"><Calendar size={12}/> PERÍODO</label>
             <select value={selectedMonthKey} onChange={(e) => setSelectedMonthKey(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded text-sm font-bold text-slate-900 p-2 focus:ring-slate-500">
               {monthOptions.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
             </select>
           </div>
           <div className="w-full md:w-1/4">
             <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center gap-1"><Target size={12}/> META (R$)</label>
             <div className="flex gap-1">
               <input type="number" value={localGoal} onChange={(e) => setLocalGoal(e.target.value)} onBlur={handleSaveGoal} className="w-full border-slate-300 rounded text-sm font-bold text-slate-900 p-2" />
               <button onClick={handleSaveGoal} className="bg-slate-700 text-white px-3 rounded hover:bg-slate-800" title="Salvar"><Target size={16} /></button>
             </div>
           </div>
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
          {/* SEÇÃO 2: TOTAIS */}
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
              <p className="text-[10px] text-slate-300 uppercase font-bold flex items-center gap-1"><Calculator size={12}/> Faturamento Total</p>
              <p className="text-lg font-bold text-blue-300 mt-1">{formatBRL(grossRevenue)}</p>
              <p className="text-[9px] text-slate-400">Venda + Frete</p>
            </div>
            <div className="px-4">
              <p className="text-[10px] text-slate-300 uppercase font-bold">Lucro Total</p>
              <p className={`text-lg font-bold mt-1 ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatBRL(totalProfit)}</p>
              <p className="text-[9px] text-slate-400">Realizado</p>
            </div>
            <div className="px-4">
              <p className="text-[10px] text-slate-300 uppercase font-bold flex items-center gap-1"><Trophy size={12}/> Comissão ({commRate}%)</p>
              <p className="text-lg font-bold text-yellow-400 mt-1">{formatBRL(commission)}</p>
              <p className="text-[9px] text-slate-400">Estimada</p>
            </div>
          </div>

          {/* SEÇÃO 3: LISTA AGRUPADA POR CLIENTE */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
            <div className="p-3 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
               <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2"><List size={16}/> Vendas por Cliente</h3>
               <button className="text-xs font-bold text-slate-500 flex items-center gap-1 hover:text-slate-800"><Download size={14}/> Exportar</button>
            </div>
            
            <div className="overflow-x-auto">
               {groupedData.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-sm">Nenhuma venda encontrada.</div>
               ) : (
                  <div className="divide-y divide-slate-100">
                     {/* Cabeçalho da Tabela Principal */}
                     <div className="grid grid-cols-12 bg-slate-100 p-3 text-xs font-bold text-slate-600 uppercase">
                        <div className="col-span-4 pl-8">Cliente</div>
                        <div className="col-span-1 text-right">M²</div>
                        <div className="col-span-2 text-right">Venda (Pedra)</div>
                        <div className="col-span-1 text-right">Frete</div>
                        <div className="col-span-2 text-right">Total Nota</div>
                        <div className="col-span-2 text-right pr-2">Lucro / Margem</div>
                     </div>

                     {groupedData.map((group, idx) => {
                        const isExpanded = expandedClients[group.name];
                        return (
                           <div key={idx} className="bg-white transition-colors hover:bg-slate-50">
                              {/* Linha Resumo do Cliente */}
                              <div 
                                onClick={() => toggleClient(group.name)} 
                                className="grid grid-cols-12 p-3 text-xs items-center cursor-pointer border-l-4 border-transparent hover:border-cyan-500"
                              >
                                 <div className="col-span-4 flex items-center gap-2 font-bold text-slate-800 truncate">
                                    {isExpanded ? <ChevronDown size={14} className="text-cyan-600"/> : <ChevronRight size={14} className="text-slate-400"/>}
                                    {group.name}
                                    <span className="text-[9px] font-normal text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full ml-2">
                                       {group.items.length} itens
                                    </span>
                                 </div>
                                 <div className="col-span-1 text-right text-slate-500">{formatNum(group.totalM2)}</div>
                                 <div className="col-span-2 text-right font-medium text-blue-700">{formatBRL(group.totalRevenue)}</div>
                                 <div className="col-span-1 text-right text-orange-600">{group.totalFreight > 0 ? formatBRL(group.totalFreight) : '-'}</div>
                                 <div className="col-span-2 text-right font-bold text-slate-800">{formatBRL(group.totalGross)}</div>
                                 <div className="col-span-2 text-right pr-2">
                                    <div className={`font-bold ${group.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatBRL(group.profit)}</div>
                                    <div className="text-[9px] text-slate-400 font-medium">Margem: {group.margin.toFixed(1)}%</div>
                                 </div>
                              </div>

                              {/* Tabela Detalhada (Expandida) */}
                              {isExpanded && (
                                 <div className="bg-slate-50 border-t border-b border-slate-100 p-2 pl-8 animate-in slide-in-from-top-2 duration-200">
                                    <table className="w-full text-[10px] text-left">
                                       <thead className="text-slate-400 font-semibold border-b border-slate-200">
                                          <tr>
                                             <th className="pb-2 pl-2">Data</th>
                                             <th className="pb-2">Material</th>
                                             <th className="pb-2 text-center">Chapa</th>
                                             <th className="pb-2 text-right">M²</th>
                                             <th className="pb-2 text-right">Venda Liq.</th>
                                             <th className="pb-2 text-right">Custo (CMV)</th>
                                             <th className="pb-2 text-right">Lucro Real</th>
                                             <th className="pb-2 text-right pr-2">Margem %</th>
                                          </tr>
                                       </thead>
                                       <tbody className="divide-y divide-slate-200/50">
                                          {group.items.sort((a,b) => new Date(a.date) - new Date(b.date)).map((item, i) => (
                                             <tr key={i} className="hover:bg-slate-100">
                                                <td className="py-2 pl-2 text-slate-500">{new Date(item.date).toLocaleDateString()}</td>
                                                <td className="py-2 text-slate-700 font-medium truncate max-w-[150px]">{item.material}</td>
                                                <td className="py-2 text-center text-slate-500">{item.chapa || '-'}</td>
                                                <td className="py-2 text-right text-slate-500">{formatNum(item.m2_total)}</td>
                                                <td className="py-2 text-right text-blue-700 font-medium">{formatBRL(item.revenue)}</td>
                                                <td className="py-2 text-right text-slate-400">{formatBRL(item.cost)}</td>
                                                <td className={`py-2 text-right font-bold ${item.profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatBRL(item.profit)}</td>
                                                <td className="py-2 text-right pr-2 font-bold text-slate-600">{item.margin.toFixed(1)}%</td>
                                             </tr>
                                          ))}
                                       </tbody>
                                    </table>
                                    <div className="text-[9px] text-slate-400 mt-2 italic text-right pr-2">
                                       * Lucro Real = Venda - Custo - Impostos({taxRate}%) - Comissão({commRate}%) | Margem = (Lucro/Custo)*100
                                    </div>
                                 </div>
                              )}
                           </div>
                        );
                     })}
                  </div>
               )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}