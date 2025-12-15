"use client";

import { useState, useEffect, useMemo } from 'react';
import { Settings, FileMinus, Plus, Trash2, RefreshCw, Scale, AlertTriangle } from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { updateSettings, addExpense, deleteExpense, saveManualScenario, getManualScenario } from '@/app/actions';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function FinancialTab({ summary, settings, expenses, onSettingsChange, onExpensesChange }) {
  const [selectedMonth, setSelectedMonth] = useState('');
  const [loading, setLoading] = useState(false);
  const [manualData, setManualData] = useState(null);
  const [localSettings, setLocalSettings] = useState(settings);
  const [newExpense, setNewExpense] = useState({ name: '', value: '', type: 'FIXED' });

  // Seletores de Mês
  const months = useMemo(() => {
    return [...summary]
      .sort((a, b) => (b.year - a.year) || (b.month - a.month))
      .map(item => ({
        key: `${item.year}-${item.month}`,
        label: new Date(item.year, item.month - 1, 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
      }));
  }, [summary]);

  useEffect(() => {
    if (months.length > 0 && !selectedMonth) setSelectedMonth(months[0].key);
  }, [months, selectedMonth]);

  useEffect(() => {
    if (!selectedMonth) return;
    async function loadScenario() {
      const data = await getManualScenario(selectedMonth);
      setManualData(data);
    }
    loadScenario();
  }, [selectedMonth]);

  // --- CÁLCULOS DO SISTEMA (REALIZADO) ---
  const currentSummary = summary.find(s => `${s.year}-${s.month}` === selectedMonth) || {};
  
  // 1. Definições de Receita (Regra de Negócio)
  const sysNetRev = Number(currentSummary.total_net_revenue) || 0; // Venda Pedra (Base Impostos)
  const sysFreight = Number(currentSummary.total_freight) || 0;    // Frete (Repasse)
  const sysGross = sysNetRev + sysFreight;                         // Total Nota
  const sysCMV = Number(currentSummary.total_cost) || 0;
  
  // 2. Metragens
  const m2Total = Number(currentSummary.total_m2) || 0;
  const m2High = Number(currentSummary.total_m2_high) || 0;
  const m2Low = Number(currentSummary.total_m2_low) || 0;

  // 3. Taxas (Aplicadas sobre a Venda Pedra)
  const rateTax = Number(settings.tax_rate) || 0;
  const rateComm = Number(settings.comm_rate) || 0;
  const rateBad = Number(settings.bad_debt_rate) || 0;

  const sysTaxes = sysNetRev * (rateTax / 100);
  const sysComms = sysNetRev * (rateComm / 100);
  const sysBadDebt = sysNetRev * (rateBad / 100);
  
  // Margem Contribuição = Venda Pedra - CMV - Impostos - Comissões
  const sysMargin = sysNetRev - sysCMV - sysTaxes - sysComms - sysBadDebt;

  // 4. Despesas Operacionais
  const currentExpenses = expenses || [];
  const sysFixedExp = currentExpenses.filter(e => e.type === 'FIXED').reduce((acc, curr) => acc + Number(curr.value), 0);
  const sysVarExp = currentExpenses.filter(e => e.type === 'VARIABLE' && e.month_key === selectedMonth).reduce((acc, curr) => acc + Number(curr.value), 0);

  // Lucro Líquido
  const sysProfit = sysMargin - sysFixedExp - sysVarExp;
  const sysProfitPct = sysNetRev > 0 ? (sysProfit / sysNetRev) * 100 : 0; // % sobre Venda Pedra

  // --- DADOS MANUAIS (SIMULAÇÃO) ---
  const manRevenue = manualData?.gross_revenue ?? sysNetRev; // Simulamos a Venda Pedra
  const manFreight = manualData?.freight ?? sysFreight;
  const manGross = manRevenue + manFreight; // Recalcula Total Nota
  
  const manCMV = manualData?.cmv ?? sysCMV;
  const manRateTax = manualData?.tax_rate ?? rateTax;
  const manRateComm = manualData?.comm_rate ?? rateComm;
  
  const manTaxes = manRevenue * (manRateTax / 100);
  const manComms = manRevenue * (manRateComm / 100);
  const manBadDebt = manRevenue * (rateBad / 100); 
  
  const manMargin = manRevenue - manCMV - manTaxes - manComms - manBadDebt;
  
  const manFixedExp = manualData?.fixed_expenses ?? sysFixedExp;
  const manVarExp = manualData?.variable_expenses ?? sysVarExp;
  
  const manProfit = manMargin - manFixedExp - manVarExp;
  const manProfitPct = manRevenue > 0 ? (manProfit / manRevenue) * 100 : 0;

  // Unit Economics
  const totalOpExpenses = sysFixedExp + sysVarExp;
  const costPerM2 = m2Total > 0 ? totalOpExpenses / m2Total : 0;

  // Handlers
  const handleSaveSettings = async () => { setLoading(true); const res = await updateSettings(localSettings); setLoading(false); if(res.success){onSettingsChange(localSettings); alert('Salvo!');} else alert(res.message); };
  const handleAddExpense = async () => { if (!newExpense.name || !newExpense.value) return; setLoading(true); const payload = { ...newExpense, month_key: newExpense.type === 'VARIABLE' ? selectedMonth : null }; const res = await addExpense(payload); setLoading(false); if(res.success){ onExpensesChange([...expenses, res.data]); setNewExpense({ name: '', value: '', type: 'FIXED' }); } else alert(res.message); };
  const handleDeleteExpense = async (id) => { if(!confirm('Apagar?')) return; const res = await deleteExpense(id); if(res.success) onExpensesChange(expenses.filter(e => e.id !== id)); else alert(res.message); };
  const handleManualUpdate = async (field, value) => { const newData = { month_key: selectedMonth, gross_revenue: manRevenue, freight: manFreight, cmv: manCMV, tax_rate: manRateTax, comm_rate: manRateComm, fixed_expenses: manFixedExp, variable_expenses: manVarExp, ...{ [field]: Number(value) } }; setManualData(prev => ({ ...prev, ...newData })); await saveManualScenario(newData); };
  const handleResetManual = async () => { if(!confirm("Resetar simulação?")) return; setManualData(null); };

  const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  const formatPct = (val) => `${val.toFixed(1)}%`;

  const chartData = {
    labels: ['Faturamento (Pedra)', 'Margem Contrib.', 'Lucro Líquido'],
    datasets: [
      { label: 'Realizado', data: [sysNetRev, sysMargin, sysProfit], backgroundColor: '#94a3b8', borderRadius: 4 },
      { label: 'Simulado', data: [manRevenue, manMargin, manProfit], backgroundColor: '#6366f1', borderRadius: 4 }
    ]
  };

  return (
    <div className="space-y-6 fade-in pb-10">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
           <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2 text-sm"><Settings size={16} /> Parâmetros (Aplicados na Venda Pedra)</h3>
           <div className="grid grid-cols-3 gap-4">
              <div><label className="text-[10px] uppercase text-slate-500 font-bold">Impostos %</label><input type="number" value={localSettings.tax_rate} onChange={e => setLocalSettings({...localSettings, tax_rate: e.target.value})} onBlur={handleSaveSettings} className="w-full border-slate-300 rounded text-sm p-1.5 text-slate-900" /></div>
              <div><label className="text-[10px] uppercase text-slate-500 font-bold">Comissão %</label><input type="number" value={localSettings.comm_rate} onChange={e => setLocalSettings({...localSettings, comm_rate: e.target.value})} onBlur={handleSaveSettings} className="w-full border-slate-300 rounded text-sm p-1.5 text-slate-900" /></div>
              <div><label className="text-[10px] uppercase text-red-500 font-bold">Inadimplência %</label><input type="number" value={localSettings.bad_debt_rate} onChange={e => setLocalSettings({...localSettings, bad_debt_rate: e.target.value})} onBlur={handleSaveSettings} className="w-full border-slate-300 rounded text-sm p-1.5 text-slate-900" /></div>
           </div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
           <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2 text-sm"><FileMinus size={16} /> Adicionar Despesa</h3>
           <div className="flex gap-2 mb-3">
              <input type="text" placeholder="Nome" value={newExpense.name} onChange={e => setNewExpense({...newExpense, name: e.target.value})} className="w-1/3 border-slate-300 rounded text-xs p-2 text-slate-900" />
              <input type="number" placeholder="R$" value={newExpense.value} onChange={e => setNewExpense({...newExpense, value: e.target.value})} className="w-1/4 border-slate-300 rounded text-xs p-2 text-slate-900" />
              <select value={newExpense.type} onChange={e => setNewExpense({...newExpense, type: e.target.value})} className="w-1/4 border-slate-300 rounded text-xs p-2 text-slate-900"><option value="FIXED">Fixa</option><option value="VARIABLE">Variável</option></select>
              <button onClick={handleAddExpense} disabled={loading} className="bg-cyan-600 text-white rounded px-3 py-1"><Plus size={16} /></button>
           </div>
           <div className="max-h-24 overflow-y-auto space-y-1 custom-scroll">
              {currentExpenses.map(exp => (<div key={exp.id} className="flex justify-between p-2 bg-slate-50 rounded text-xs border border-slate-100"><span>{exp.name}</span><div className="flex gap-2 font-bold"><span>{formatBRL(exp.value)}</span><button onClick={() => handleDeleteExpense(exp.id)} className="text-red-500"><Trash2 size={12}/></button></div></div>))}
           </div>
        </div>
      </div>

      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative z-10">
        <div className="flex items-center gap-4"><h3 className="font-bold text-slate-800 text-lg">Comparativo Financeiro</h3><select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="bg-slate-100 border-none rounded text-sm font-bold text-slate-900 py-1 px-3">{months.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}</select></div>
        <button onClick={handleResetManual} className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg font-bold"><RefreshCw size={12} /> Resetar</button>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h4 className="font-bold text-slate-700 flex items-center gap-2 mb-4 border-b border-slate-100 pb-2"><Scale size={18} className="text-cyan-600" /> Eficiência Operacional</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex flex-col items-center justify-center text-center">
            <span className="text-xs font-bold text-slate-500 uppercase mb-1">Custo Op. por M²</span><span className="text-2xl font-extrabold text-red-600">{formatBRL(costPerM2)}</span><span className="text-[10px] text-slate-400 mt-1">Gasto fixo para produzir 1 m²</span>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg border border-purple-100 flex flex-col justify-center">
            <div className="flex justify-between items-center mb-2"><span className="text-xs font-bold text-purple-700 uppercase">Alto Valor ({m2High.toFixed(0)} m²)</span><span className="text-[10px] bg-purple-200 text-purple-800 px-1 rounded">Vol: {m2Total > 0 ? ((m2High/m2Total)*100).toFixed(0) : 0}%</span></div>
            <div className="w-full bg-purple-200 h-1.5 rounded-full mt-1"><div className="bg-purple-600 h-1.5 rounded-full" style={{width: '90%'}}></div></div>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg border border-orange-100 flex flex-col justify-center">
             <div className="flex justify-between items-center mb-2"><span className="text-xs font-bold text-orange-700 uppercase">Baixo Valor ({m2Low.toFixed(0)} m²)</span><span className="text-[10px] bg-orange-200 text-orange-800 px-1 rounded">Vol: {m2Total > 0 ? ((m2Low/m2Total)*100).toFixed(0) : 0}%</span></div>
             <div className="flex items-start gap-2 mt-2 bg-white p-2 rounded border border-orange-100"><AlertTriangle size={14} className="text-orange-500 shrink-0 mt-0.5" /><p className="text-[10px] text-slate-500 leading-tight">Custo Operacional: <strong>{formatBRL(costPerM2)}</strong>/m²</p></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         {/* DRE REALIZADO */}
         <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 shadow-inner">
            <h4 className="font-bold text-slate-500 uppercase text-xs mb-4 text-center border-b border-slate-200 pb-2">Dados do Sistema (Realizado)</h4>
            <div className="space-y-3 text-sm">
               <DreRow label="(+) Total Nota (Bruto + Frete)" value={sysGross} isSmall />
               <DreRow label="(-) Fretes (Repasse)" value={sysFreight} isRed isSmall />
               
               {/* LINHA DE DESTAQUE: RECEITA VENDA */}
               <div className="flex justify-between border-t border-b border-slate-200 py-2 font-bold text-blue-800 bg-blue-50/50 px-2 rounded">
                 <span>(=) Faturamento Bruto (Pedra)</span>
                 <span>{formatBRL(sysNetRev)}</span>
               </div>
               
               <DreRowInput label="(-) CMV (Custo Pedra)" value={sysCMV} pct={sysNetRev ? sysCMV/sysNetRev*100 : 0} isRed />
               <div className="pl-2 border-l-2 border-slate-200 space-y-1 mt-2">
                 <DreRowInput label="(-) Impostos" value={sysTaxes} pct={rateTax} isSmall />
                 <DreRowInput label="(-) Comissões" value={sysComms} pct={rateComm} isSmall />
                 <DreRowInput label="(-) Inadimplência" value={sysBadDebt} pct={rateBad} isSmall />
               </div>
               <div className="flex justify-between font-bold text-orange-700 mt-2 bg-orange-50 p-1 rounded"><span>(=) Margem Contrib.</span><span>{formatBRL(sysMargin)}</span></div>
               <div className="pl-2 space-y-1 mt-1">
                 <DreRowInput label="(-) Fixas" value={sysFixedExp} pct={sysNetRev ? sysFixedExp/sysNetRev*100 : 0} isSmall />
                 <DreRowInput label="(-) Variáveis" value={sysVarExp} pct={sysNetRev ? sysVarExp/sysNetRev*100 : 0} isSmall />
               </div>
               <div className="flex justify-between p-3 bg-white rounded-lg border-2 border-green-100 mt-4 shadow-sm"><span className="font-extrabold text-green-800">LUCRO LÍQUIDO</span><div className="flex flex-col items-end"><span className={`font-extrabold text-lg ${sysProfit >= 0 ? 'text-green-800' : 'text-red-600'}`}>{formatBRL(sysProfit)}</span><span className="text-[10px] font-bold text-green-600">{formatPct(sysProfitPct)}</span></div></div>
            </div>
         </div>

         {/* DRE SIMULADO */}
         <div className="bg-white p-6 rounded-xl border-2 border-indigo-100 shadow-sm relative">
            <div className="absolute top-0 right-0 bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-1 rounded-bl-lg">EDITÁVEL</div>
            <h4 className="font-bold text-indigo-600 uppercase text-xs mb-4 text-center border-b border-indigo-100 pb-2">Análise Manual</h4>
            <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center text-xs text-slate-400">
                   <span>Total Nota (Calc):</span>
                   <span>{formatBRL(manGross)}</span>
                </div>
                <DreInput label="(-) Fretes" val={manFreight} onChange={v => handleManualUpdate('freight', v)} isRed isSmall />
                
                <div className="flex justify-between border-t border-b border-indigo-100 py-2 font-bold text-indigo-800 bg-indigo-50 px-2 rounded">
                  <span>(=) Fat. Bruto (Pedra)</span>
                  <div className="flex items-center gap-2">
                     <span className="text-[10px] text-indigo-400 font-normal">Base</span>
                     <input type="number" value={manRevenue || 0} onChange={e => handleManualUpdate('gross_revenue', e.target.value)} className="input-clean text-right bg-transparent border-b border-indigo-300 w-24 focus:ring-0 focus:border-indigo-600 font-bold text-indigo-900" />
                  </div>
                </div>

                <DreInput label="(-) CMV" val={manCMV} onChange={v => handleManualUpdate('cmv', v)} isRed />
                <div className="pl-2 border-l-2 border-indigo-100 space-y-2 mt-2">
                   <DreInputRate label="Impostos" val={manRateTax} onChange={v => handleManualUpdate('tax_rate', v)} displayVal={manTaxes} />
                   <DreInputRate label="Comissões" val={manRateComm} onChange={v => handleManualUpdate('comm_rate', v)} displayVal={manComms} />
                </div>
                <div className="flex justify-between font-bold text-orange-700 mt-2 px-1"><span>(=) Margem Contrib.</span><span>{formatBRL(manMargin)}</span></div>
                <div className="pl-2 space-y-2 mt-2">
                  <DreInput label="(-) Desp. Fixas" val={manFixedExp} onChange={v => handleManualUpdate('fixed_expenses', v)} isSmall />
                  <DreInput label="(-) Desp. Variáveis" val={manVarExp} onChange={v => handleManualUpdate('variable_expenses', v)} isSmall />
                </div>
                <div className="flex justify-between p-3 bg-indigo-50 rounded-lg border-2 border-indigo-200 mt-4 shadow-sm"><span className="font-extrabold text-indigo-900">LUCRO PROJETADO</span><div className="flex flex-col items-end"><span className={`font-extrabold text-lg ${manProfit >= 0 ? 'text-indigo-900' : 'text-red-600'}`}>{formatBRL(manProfit)}</span><span className="text-[10px] font-bold text-indigo-600">{formatPct(manProfitPct)}</span></div></div>
            </div>
         </div>
      </div>

      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        <h3 className="font-bold text-slate-700 mb-4 text-sm">Comparativo</h3>
        <div className="relative h-64"><Bar data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: '#f1f5f9' } } } }} /></div>
      </div>
    </div>
  );
}

// Helpers
function DreRow({ label, value, isBold, isRed, isSmall }) { const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val); return (<div className={`flex justify-between items-center ${isSmall ? 'text-xs text-slate-500' : ''}`}><span className={isBold ? 'text-slate-600 font-medium' : ''}>{label}</span><span className={`font-bold ${isRed ? 'text-red-400' : 'text-slate-800'}`}>{formatBRL(value)}</span></div>); }
function DreRowInput({ label, value, pct, isRed, isSmall }) { const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val); return (<div className={`flex justify-between items-center ${isSmall ? 'text-xs text-slate-500' : ''} ${isRed ? 'bg-red-50 p-1 rounded border border-red-100' : ''}`}><span>{label}</span><div className="flex gap-2"><span className={`text-[10px] px-1 rounded self-center ${isRed ? 'bg-red-100 text-red-700' : 'bg-slate-100'}`}>{pct.toFixed(1)}%</span><span className={isRed ? 'text-red-700 font-bold' : 'text-red-500'}>{formatBRL(value)}</span></div></div>); }
function DreInput({ label, val, onChange, isBold, isRed, isSmall }) { return (<div className={`flex justify-between items-center ${isSmall ? 'text-xs' : ''} ${isRed ? 'bg-red-50 p-1 rounded border border-red-100' : ''}`}><span className={`${isBold ? 'text-slate-600 font-medium' : 'text-slate-500'} ${isRed ? 'text-red-700 font-bold' : ''}`}>{label}</span><input type="number" value={val || 0} onChange={e => onChange(e.target.value)} className={`input-clean text-right bg-transparent border-b border-slate-300 w-24 focus:ring-0 focus:border-indigo-500 ${isRed ? 'text-red-700 font-bold' : 'text-indigo-900 font-bold'} ${isSmall ? 'text-xs' : ''} text-slate-900`} /></div>); }
function DreInputRate({ label, val, onChange, displayVal }) { const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val); return (<div className="flex justify-between items-center text-xs"><span className="text-slate-500">{label} (<input type="number" value={val} onChange={e => onChange(e.target.value)} className="w-8 text-center border-b border-slate-300 text-[10px] bg-transparent focus:outline-none focus:border-indigo-500 text-slate-900" />%)</span><span className="text-red-500">{formatBRL(displayVal)}</span></div>); }