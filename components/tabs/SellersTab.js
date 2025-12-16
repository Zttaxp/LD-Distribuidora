"use client";

import { useState, useEffect, useMemo } from 'react';
import { Target, Trophy, Filter, Download, Calendar, DollarSign, List, Truck, Calculator, Loader2, ChevronDown, ChevronRight, Gem, Layers, ArrowUpDown, BarChart3, Lock } from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { getSellerDetails, saveSellerGoal, getSellersRanking } from '@/app/actions';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// --- PERMISSÕES ---
// No futuro, isso virá do seu banco de dados (tabela de perfis).
// Por enquanto, aceitamos a prop 'currentUser' para controlar a tela.
export default function SellersTab({ sellers = [], settings, currentUser = { role: 'admin', name: '' } }) {
  
  const [selectedSeller, setSelectedSeller] = useState('');
  const [selectedMonthKey, setSelectedMonthKey] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [detailData, setDetailData] = useState({ sales: [], goal: 0 });
  const [localGoal, setLocalGoal] = useState(0);
  const [rankingData, setRankingData] = useState([]);
  const [expandedClients, setExpandedClients] = useState({});
  const [sortBy, setSortBy] = useState('TOTAL');

  // Verifica se é Vendedor (Modo Restrito)
  const isSellerMode = currentUser?.role === 'seller';

  // --- 1. FILTROS ---
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

  // Inicialização Inteligente
  useEffect(() => {
    // Se for Vendedor, força a seleção do próprio nome
    if (isSellerMode && currentUser.name) {
        setSelectedSeller(currentUser.name.toUpperCase());
    } 
    // Se for Admin, seleciona o primeiro da lista se não houver seleção
    else if (sellersList.length > 0 && !selectedSeller) {
        setSelectedSeller(sellersList[0]);
    }

    if (monthOptions.length > 0 && !selectedMonthKey) {
        setSelectedMonthKey(monthOptions[0].key);
    }
  }, [sellersList, monthOptions, selectedSeller, selectedMonthKey, isSellerMode, currentUser]);

  // Carrega Dados Detalhados
  useEffect(() => {
    if (!selectedSeller || !selectedMonthKey) return;
    async function loadData() {
      setLoading(true);
      try {
        const [year, month] = selectedMonthKey.split('-').map(Number);
        const result = await getSellerDetails(selectedSeller, month, year);
        setDetailData(result || { sales: [], goal: 0 });
        setLocalGoal(result?.goal || 0);
        setExpandedClients({});
      } catch (error) { 
        console.error(error); 
        setDetailData({ sales: [], goal: 0 });
      } finally { 
        setLoading(false); 
      }
    }
    loadData();
  }, [selectedSeller, selectedMonthKey]);

  // Carrega Ranking (Apenas se for ADMIN)
  useEffect(() => {
    if (!selectedMonthKey || isSellerMode) return; // Vendedores não veem o ranking geral
    async function loadRanking() {
        const [year, month] = selectedMonthKey.split('-').map(Number);
        const data = await getSellersRanking(month, year);
        setRankingData(data || []);
    }
    loadRanking();
  }, [selectedMonthKey, isSellerMode]);

  const handleSaveGoal = async () => { 
      // Vendedores não podem alterar suas metas, apenas Admins
      if(isSellerMode) return alert('Apenas administradores podem definir metas.');
      try { await saveSellerGoal(selectedSeller, selectedMonthKey, localGoal); alert('Meta salva!'); } catch (e) { alert('Erro ao salvar meta.'); } 
  };
  
  const toggleClient = (clientName) => {
    setExpandedClients(prev => ({ ...prev, [clientName]: !prev[clientName] }));
  };

  // --- GRÁFICO (Só Admin vê) ---
  const chartData = {
    labels: rankingData.map(d => d.name.split(' ')[0]),
    datasets: [
        { label: 'Total Vendido', data: rankingData.map(d => d.totalRev), backgroundColor: '#3b82f6', borderRadius: 4 },
        { label: 'Alto Valor (>300)', data: rankingData.map(d => d.highRev), backgroundColor: '#a855f7', borderRadius: 4 }
    ]
  };

  const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' }, tooltip: { callbacks: { label: function(context) { let label = context.dataset.label || ''; if (label) { label += ': '; } if (context.parsed.y !== null) { label += new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(context.parsed.y); } return label; } } } }, scales: { y: { beginAtZero: true, grid: { color: '#f1f5f9' } }, x: { grid: { display: false } } } };

  // --- CÁLCULOS ---
  const salesList = detailData?.sales || [];
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
  const commission = totals.netRevenue * (commRate / 100);
  const totalProfit = totals.netRevenue - totals.cost;
  const goal = Number(localGoal) || 0;
  const progressPct = goal > 0 ? (totals.netRevenue / goal) * 100 : 0;
  const missing = Math.max(0, goal - totals.netRevenue);

  const groupedData = useMemo(() => {
    const groups = {};
    salesList.forEach(sale => {
      const client = sale.client || 'Consumidor Final';
      if (!groups[client]) {
        groups[client] = { name: client, items: [], totalM2: 0, totalRevenue: 0, totalFreight: 0, totalCost: 0, totalGross: 0, highValueRevenue: 0, highValueM2: 0 };
      }
      
      const sRev = Number(sale.revenue || 0); const sCost = Number(sale.cost || 0); const sM2 = Number(sale.m2_total || 0); const sProfit = sRev - sCost; const sMargin = sCost > 0 ? (sProfit / sCost) * 100 : 0;
      const unitPrice = sM2 > 0 ? sRev / sM2 : 0; const isHighValue = unitPrice > 300;
      const itemWithCalc = { ...sale, profit: sProfit, margin: sMargin, unitPrice, isHighValue };
      
      groups[client].items.push(itemWithCalc);
      groups[client].totalM2 += sM2; groups[client].totalRevenue += sRev; groups[client].totalFreight += Number(sale.freight || 0); groups[client].totalCost += sCost; groups[client].totalGross += (sRev + Number(sale.freight || 0));
      if (isHighValue) { groups[client].highValueRevenue += sRev; groups[client].highValueM2 += sM2; }
    });
    const list = Object.values(groups).map(g => { const gProfit = g.totalRevenue - g.totalCost; const gMargin = g.totalCost > 0 ? (gProfit / g.totalCost) * 100 : 0; return { ...g, profit: gProfit, margin: gMargin }; });
    if (sortBy === 'HIGH_VALUE') { return list.sort((a, b) => b.highValueRevenue - a.highValueRevenue); }
    return list.sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [salesList, sortBy]);

  const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  const formatNum = (val) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val || 0);

  return (
    <div className="space-y-6 fade-in pb-20">
      
      {/* SEÇÃO 1: FILTROS */}
      <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row gap-4 items-end">
           <div className="w-full md:w-1/4">
             <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center gap-1"><Filter size={12}/> VENDEDOR</label>
             {/* LÓGICA DE TRAVAMENTO DE USUÁRIO */}
             {isSellerMode ? (
                <div className="w-full bg-slate-100 border border-slate-300 rounded text-sm font-bold text-slate-700 p-2 flex items-center gap-2">
                    <Lock size={14} className="text-slate-400"/>
                    {selectedSeller}
                </div>
             ) : (
                <select value={selectedSeller} onChange={(e) => setSelectedSeller(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded text-sm font-bold text-slate-900 p-2 focus:ring-slate-500">
                   {sellersList.length === 0 && <option value="">Sem vendedores...</option>}
                   {sellersList.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
             )}
           </div>
           <div className="w-full md:w-1/4">
             <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center gap-1"><Calendar size={12}/> PERÍODO</label>
             <select value={selectedMonthKey} onChange={(e) => setSelectedMonthKey(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded text-sm font-bold text-slate-900 p-2 focus:ring-slate-500">
               {monthOptions.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
             </select>
           </div>
           <div className="w-full md:w-1/4">
             <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center gap-1"><Target size={12}/> META INDIVIDUAL (R$)</label>
             <div className="flex gap-1">
               <input type="number" value={localGoal} disabled={isSellerMode} onChange={(e) => setLocalGoal(e.target.value)} onBlur={handleSaveGoal} className={`w-full border-slate-300 rounded text-sm font-bold text-slate-900 p-2 ${isSellerMode ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`} />
               {!isSellerMode && <button onClick={handleSaveGoal} className="bg-slate-700 text-white px-3 rounded hover:bg-slate-800" title="Salvar"><Target size={16} /></button>}
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

      {/* SEÇÃO 1.5: RANKING COMPARATIVO (SÓ ADMIN VÊ) */}
      {!isSellerMode && (
          <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
             <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2 text-sm"><BarChart3 size={16} className="text-cyan-600"/> Comparativo de Performance (Todos os Vendedores)</h3>
             <div className="h-64 w-full">
                <Bar data={chartData} options={chartOptions} />
             </div>
          </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20 text-slate-400"><Loader2 className="animate-spin" size={40} /></div> 
      ) : (
        <>
          {/* SEÇÃO 2: TOTAIS VENDEDOR SELECIONADO */}
          <div className="bg-slate-800 text-white rounded-lg shadow-md p-4 grid grid-cols-2 md:grid-cols-5 gap-4 divide-x divide-slate-600">
            <div className="px-2">
              <p className="text-[10px] text-slate-300 uppercase font-bold flex items-center gap-1"><DollarSign size={12}/> Venda Líquida</p>
              <p className="text-lg font-bold text-white mt-1">{formatBRL(totals.netRevenue)}</p>
              <p className="text-[9px] text-slate-400">Base Comissão</p>
            </div>
            {/* Fretes e Faturamento Total: Vendedores podem ver? Geralmente sim, para conferir NF */}
            <div className="px-4">
              <p className="text-[10px] text-slate-300 uppercase font-bold flex items-center gap-1"><Truck size={12}/> Fretes</p>
              <p className="text-lg font-bold text-orange-300 mt-1">{formatBRL(totals.freight)}</p>
            </div>
            <div className="px-4">
              <p className="text-[10px] text-slate-300 uppercase font-bold flex items-center gap-1"><Calculator size={12}/> Faturamento Total</p>
              <p className="text-lg font-bold text-blue-300 mt-1">{formatBRL(grossRevenue)}</p>
            </div>
            {/* Lucro Real: Algumas empresas escondem dos vendedores. Se quiser esconder, adicione !isSellerMode && ... */}
            <div className="px-4">
              <p className="text-[10px] text-slate-300 uppercase font-bold">Lucro Real (Bruto)</p>
              <p className={`text-lg font-bold mt-1 ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatBRL(totalProfit)}</p>
            </div>
            <div className="px-4">
              <p className="text-[10px] text-slate-300 uppercase font-bold flex items-center gap-1"><Trophy size={12}/> Comissão ({commRate}%)</p>
              <p className="text-lg font-bold text-yellow-400 mt-1">{formatBRL(commission)}</p>
            </div>
          </div>

          {/* SEÇÃO 3: LISTA CLIENTES */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
            <div className="p-3 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row justify-between items-center gap-3">
               <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2"><List size={16}/> Detalhes: {selectedSeller}</h3>
               
               <div className="flex bg-slate-200 p-1 rounded-md">
                  <button onClick={() => setSortBy('TOTAL')} className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-bold transition-all ${sortBy === 'TOTAL' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><DollarSign size={12}/> Venda Total</button>
                  <button onClick={() => setSortBy('HIGH_VALUE')} className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-bold transition-all ${sortBy === 'HIGH_VALUE' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Gem size={12}/> Ranking Alto Valor</button>
               </div>
            </div>
            
            <div className="overflow-x-auto">
               {groupedData.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-sm">Nenhuma venda encontrada para este vendedor.</div>
               ) : (
                  <div className="divide-y divide-slate-100">
                     <div className="grid grid-cols-12 bg-slate-100 p-3 text-xs font-bold text-slate-600 uppercase">
                        <div className="col-span-4 pl-8">Cliente</div>
                        <div className="col-span-1 text-right">M²</div>
                        <div className="col-span-2 text-right">Venda (Pedra)</div>
                        <div className="col-span-2 text-right text-purple-600">Alto Valor (&gt;300)</div>
                        <div className="col-span-1 text-right">Frete</div>
                        <div className="col-span-2 text-right pr-2">Lucro / Margem</div>
                     </div>

                     {groupedData.map((group, idx) => {
                        const isExpanded = expandedClients[group.name];
                        const highValuePct = group.totalRevenue > 0 ? (group.highValueRevenue / group.totalRevenue) * 100 : 0;
                        return (
                           <div key={idx} className="bg-white transition-colors hover:bg-slate-50">
                              <div onClick={() => toggleClient(group.name)} className={`grid grid-cols-12 p-3 text-xs items-center cursor-pointer border-l-4 ${sortBy === 'HIGH_VALUE' ? 'border-purple-400' : 'border-transparent hover:border-cyan-500'}`}>
                                 <div className="col-span-4 flex items-center gap-2 font-bold text-slate-800 truncate">
                                    {isExpanded ? <ChevronDown size={14} className="text-cyan-600 shrink-0"/> : <ChevronRight size={14} className="text-slate-400 shrink-0"/>}
                                    <span className="truncate">{group.name}</span>
                                    {highValuePct > 50 && <Gem size={12} className="text-purple-500 shrink-0" title="Cliente Premium" />}
                                 </div>
                                 <div className="col-span-1 text-right text-slate-500">{formatNum(group.totalM2)}</div>
                                 <div className="col-span-2 text-right font-medium text-blue-700">{formatBRL(group.totalRevenue)}</div>
                                 <div className="col-span-2 text-right flex flex-col justify-center items-end">
                                    <span className={`font-bold ${group.highValueRevenue > 0 ? 'text-purple-700' : 'text-slate-300'}`}>{formatBRL(group.highValueRevenue)}</span>
                                    {group.highValueRevenue > 0 && <span className="text-[9px] bg-purple-100 text-purple-700 px-1 rounded">{highValuePct.toFixed(0)}% do mix</span>}
                                 </div>
                                 <div className="col-span-1 text-right text-orange-600">{group.totalFreight > 0 ? formatBRL(group.totalFreight) : '-'}</div>
                                 <div className="col-span-2 text-right pr-2">
                                    <div className={`font-bold ${group.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatBRL(group.profit)}</div>
                                    <div className="text-[9px] text-slate-400 font-medium">{group.margin.toFixed(1)}%</div>
                                 </div>
                              </div>

                              {isExpanded && (
                                 <div className="bg-slate-50 border-t border-b border-slate-100 p-2 pl-8 animate-in slide-in-from-top-2 duration-200">
                                    <table className="w-full text-[10px] text-left">
                                       <thead className="text-slate-400 font-semibold border-b border-slate-200">
                                          <tr>
                                             <th className="pb-2 pl-2">Data</th>
                                             <th className="pb-2">Material / Classificação</th>
                                             <th className="pb-2 text-center">Chapa</th>
                                             <th className="pb-2 text-right">M²</th>
                                             <th className="pb-2 text-right">R$/m²</th>
                                             <th className="pb-2 text-right">Venda Liq.</th>
                                             <th className="pb-2 text-right">Lucro</th>
                                          </tr>
                                       </thead>
                                       <tbody className="divide-y divide-slate-200/50">
                                          {group.items.sort((a,b) => new Date(a.date) - new Date(b.date)).map((item, i) => (
                                             <tr key={i} className="hover:bg-slate-100">
                                                <td className="py-2 pl-2 text-slate-500">{new Date(item.date).toLocaleDateString()}</td>
                                                <td className="py-2 text-slate-700 font-medium">
                                                    <div className="flex items-center gap-2">
                                                        <span className="truncate max-w-[150px]">{item.material}</span>
                                                        {item.isHighValue ? <span className="flex items-center gap-1 bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-[9px] font-bold border border-purple-200"><Gem size={8} /> Alto</span> : <span className="flex items-center gap-1 bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded text-[9px] font-bold border border-orange-100"><Layers size={8} /> Baixo</span>}
                                                    </div>
                                                </td>
                                                <td className="py-2 text-center text-slate-500">{item.chapa || '-'}</td>
                                                <td className="py-2 text-right text-slate-500">{formatNum(item.m2_total)}</td>
                                                <td className="py-2 text-right text-slate-400">{formatBRL(item.unitPrice)}</td>
                                                <td className="py-2 text-right text-blue-700 font-medium">{formatBRL(item.revenue)}</td>
                                                <td className={`py-2 text-right font-bold pr-2 ${item.profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatBRL(item.profit)}</td>
                                             </tr>
                                          ))}
                                       </tbody>
                                    </table>
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