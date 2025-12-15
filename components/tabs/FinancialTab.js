"use client";

import { useState, useEffect, useMemo } from 'react';
import { Settings, FileMinus, Plus, Trash2, RefreshCw, Loader2 } from 'lucide-react';
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

  // --- CORREÇÃO DOS VALORES ZERADOS ---
  const currentSummary = summary.find(s => `${s.year}-${s.month}` === selectedMonth) || {};
  
  // Agora usamos as chaves corretas que vêm da View SQL atualizada
  const sysNetRev = Number(currentSummary.total_net_revenue) || 0;
  const sysFreight = Number(currentSummary.total_freight) || 0;
  const sysGross = sysNetRev + sysFreight; // Receita Bruta = Liq + Frete
  const sysCMV = Number(currentSummary.total_cost) || 0;
  
  const rateTax = Number(settings.tax_rate) || 0;
  const rateComm = Number(settings.comm_rate) || 0;
  const rateBad = Number(settings.bad_debt_rate) || 0;

  const sysTaxes = sysNetRev * (rateTax / 100);
  const sysComms = sysNetRev * (rateComm / 100);
  const sysBadDebt = sysNetRev * (rateBad / 100);
  const sysMargin = sysNetRev - sysCMV - sysTaxes - sysComms - sysBadDebt;

  const currentExpenses = expenses || [];
  const sysFixedExp = currentExpenses.filter(e => e.type === 'FIXED').reduce((acc, curr) => acc + Number(curr.value), 0);
  const sysVarExp = currentExpenses.filter(e => e.type === 'VARIABLE' && e.month_key === selectedMonth).reduce((acc, curr) => acc + Number(curr.value), 0);

  const sysProfit = sysMargin - sysFixedExp - sysVarExp;
  const sysProfitPct = sysNetRev > 0 ? (sysProfit / sysNetRev) * 100 : 0;

  // --- DADOS MANUAIS ---
  const manGross = manualData?.gross_revenue ?? sysGross;
  const manFreight = manualData?.freight ?? sysFreight;
  const manNetRev = manGross - manFreight;
  
  const manCMV = manualData?.cmv ?? sysCMV;
  const manRateTax = manualData?.tax_rate ?? rateTax;
  const manRateComm = manualData?.comm_rate ?? rateComm;
  
  const manTaxes = manNetRev * (manRateTax / 100);
  const manComms = manNetRev * (manRateComm / 100);
  const manBadDebt = manNetRev * (rateBad / 100); 
  
  const manMargin = manNetRev - manCMV - manTaxes - manComms - manBadDebt;
  const manFixedExp = manualData?.fixed_expenses ?? sysFixedExp;
  const manVarExp = manualData?.variable_expenses ?? sysVarExp;
  
  const manProfit = manMargin - manFixedExp - manVarExp;
  const manProfitPct = manNetRev > 0 ? (manProfit / manNetRev) * 100 : 0;

  const handleSaveSettings = async () => {
    setLoading(true);
    try {
      await updateSettings(localSettings);
      onSettingsChange(localSettings);
      alert('Configurações salvas!');
    } catch (e) { alert(e.message); } finally { setLoading(false); }
  };

  const handleAddExpense = async () => {
    if (!newExpense.name || !newExpense.value) return;
    setLoading(true);
    try {
      const payload = { ...newExpense, month_key: newExpense.type === 'VARIABLE' ? selectedMonth : null };
      const { data } = await addExpense(payload);
      onExpensesChange([...expenses, data]);
      setNewExpense({ name: '', value: '', type: 'FIXED' });
    } catch (e) { alert(e.message); } finally { setLoading(false); }
  };

  const handleDeleteExpense = async (id) => {
    if(!confirm('Apagar despesa?')) return;
    try {
      await deleteExpense(id);
      onExpensesChange(expenses.filter(e => e.id !== id));
    } catch (e) { alert(e.message); }
  };

  const handleManualUpdate = async (field, value) => {
    const newData = {
      month_key: selectedMonth,
      gross_revenue: manGross,
      freight: manFreight,
      cmv: manCMV,
      tax_rate: manRateTax,
      comm_rate: manRateComm,
      fixed_expenses: manFixedExp,
      variable_expenses: manVarExp,
      ...{ [field]: Number(value) }
    };
    setManualData(prev => ({ ...prev, ...newData }));
    await saveManualScenario(newData);
  };

  const handleResetManual = async () => {
    if(!confirm("Resetar simulação?")) return;
    setManualData(null);
  };

  const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  const formatPct = (val) => `${val.toFixed(1)}%`;

  const chartData = {
    labels: ['Faturamento', 'Margem Contrib.', 'Lucro Líquido'],
    datasets: [
      { label: 'Realizado', data: [sysGross, sysMargin, sysProfit], backgroundColor: '#94a3b8', borderRadius: 4 },
      { label: 'Simulado', data: [manGross, manMargin, manProfit], backgroundColor: '#6366f1', borderRadius: 4 }
    ]
  };

  return (
    <div className="space-y-6 fade-in pb-10">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* PARÂMETROS - INPUTS CORRIGIDOS (text-slate-900) */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2 text-sm"><Settings size={16} /> Parâmetros</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Impostos %</label>
              <input type="number" value={localSettings.tax_rate} onChange={e => setLocalSettings({...localSettings, tax_rate: e.target.value})} onBlur={handleSaveSettings} 
                className="w-full border-slate-300 rounded text-sm p-1.5 focus:ring-cyan-500 focus:border-cyan-500 text-slate-900" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Comissão %</label>
              <input type="number" value={localSettings.comm_rate} onChange={e => setLocalSettings({...localSettings, comm_rate: e.target.value})} onBlur={handleSaveSettings} 
                className="w-full border-slate-300 rounded text-sm p-1.5 focus:ring-cyan-500 focus:border-cyan-500 text-slate-900" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-red-500 uppercase">Inadimplência %</label>
              <input type="number" value={localSettings.bad_debt_rate} onChange={e => setLocalSettings({...localSettings, bad_debt_rate: e.target.value})} onBlur={handleSaveSettings} 
                className="w-full border-slate-300 rounded text-sm p-1.5 focus:ring-cyan-500 focus:border-cyan-500 text-slate-900" />
            </div>
          </div>
        </div>

        {/* DESPESAS - INPUTS CORRIGIDOS */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2 text-sm"><FileMinus size={16} /> Adicionar Despesa</h3>
          <div className="flex gap-2 mb-3">
            <input type="text" placeholder="Nome" value={newExpense.name} onChange={e => setNewExpense({...newExpense, name: e.target.value})} 
              className="w-1/3 border-slate-300 rounded text-xs p-2 text-slate-900" />
            <input type="number" placeholder="R$" value={newExpense.value} onChange={e => setNewExpense({...newExpense, value: e.target.value})} 
              className="w-1/4 border-slate-300 rounded text-xs p-2 text-slate-900" />
            <select value={newExpense.type} onChange={e => setNewExpense({...newExpense, type: e.target.value})} className="w-1/4 border-slate-300 rounded text-xs p-2 bg-white text-slate-900">
              <option value="FIXED">Fixa</option>
              <option value="VARIABLE">Variável</option>
            </select>
            <button onClick={handleAddExpense} disabled={loading} className="bg-cyan-600 text-white rounded px-3 py-1 hover:bg-cyan-700 disabled:opacity-50">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            </button>
          </div>
          <div className="max-h-24 overflow-y-auto space-y-1 custom-scroll">
            {currentExpenses.map(exp => (
              <div key={exp.id} className="flex justify-between items-center p-2 bg-slate-50 rounded text-xs border border-slate-100">
                <div className="flex flex-col"><span className="font-medium text-slate-700">{exp.name}</span><span className="text-[9px] text-slate-400">{exp.type === 'FIXED' ? 'Mensal (Fixa)' : `Variável (${exp.month_key})`}</span></div>
                <div className="flex items-center gap-2"><span className="font-bold text-slate-700">{formatBRL(exp.value)}</span><button onClick={() => handleDeleteExpense(exp.id)} className="text-red-400 hover:text-red-600"><Trash2 size={12} /></button></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative z-10">
        <div className="flex items-center gap-4 mb-2 md:mb-0">
          <h3 className="font-bold text-slate-800 text-lg">Comparativo Financeiro</h3>
          <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="bg-slate-100 border-none rounded text-sm font-bold text-slate-700 cursor-pointer py-1 px-3 focus:ring-0 text-slate-900">
            {months.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </div>
        <button onClick={handleResetManual} className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg font-bold border border-indigo-200 hover:bg-indigo-100 flex items-center gap-2"><RefreshCw size={12} /> Resetar Simulação</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 shadow-inner">
          <h4 className="font-bold text-slate-500 uppercase text-xs mb-4 text-center border-b border-slate-200 pb-2">Dados do Sistema (Realizado)</h4>
          <div className="space-y-3 text-sm">
            <DreRow label="(+) Receita Bruta" value={sysGross} isBold />
            <DreRow label="(-) Fretes" value={sysFreight} isRed isSmall />
            <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold text-blue-700"><span>(=) Receita Líquida</span><span>{formatBRL(sysNetRev)}</span></div>
            <DreRowInput label="(-) Custo Mercadoria (CMV)" value={sysCMV} pct={sysNetRev ? sysCMV/sysNetRev*100 : 0} isRed />
            <div className="pl-2 border-l-2 border-slate-200 space-y-1 mt-2">
              <DreRowInput label="(-) Impostos" value={sysTaxes} pct={rateTax} isSmall />
              <DreRowInput label="(-) Comissões" value={sysComms} pct={rateComm} isSmall />
              <DreRowInput label="(-) Inadimplência" value={sysBadDebt} pct={rateBad} isSmall />
            </div>
            <div className="flex justify-between font-bold text-orange-700 mt-2 bg-orange-50 p-1 rounded"><span>(=) Margem Contribuição</span><div className="flex gap-2"><span className="text-[10px] bg-orange-100 px-1 rounded self-center text-orange-800">{formatPct(sysNetRev ? sysMargin/sysNetRev*100 : 0)}</span><span>{formatBRL(sysMargin)}</span></div></div>
            <div className="pl-2 space-y-1 mt-1">
              <DreRowInput label="(-) Despesas Fixas" value={sysFixedExp} pct={sysNetRev ? sysFixedExp/sysNetRev*100 : 0} isSmall />
              <DreRowInput label="(-) Despesas Variáveis" value={sysVarExp} pct={sysNetRev ? sysVarExp/sysNetRev*100 : 0} isSmall />
            </div>
            <div className="flex justify-between p-3 bg-white rounded-lg border-2 border-green-100 mt-4 shadow-sm"><span className="font-extrabold text-green-800">LUCRO LÍQUIDO</span><div className="flex flex-col items-end"><span className={`font-extrabold text-lg ${sysProfit >= 0 ? 'text-green-800' : 'text-red-600'}`}>{formatBRL(sysProfit)}</span><span className="text-[10px] font-bold text-green-600">{formatPct(sysProfitPct)}</span></div></div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border-2 border-indigo-100 shadow-sm relative">
          <div className="absolute top-0 right-0 bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-1 rounded-bl-lg">EDITÁVEL</div>
          <h4 className="font-bold text-indigo-600 uppercase text-xs mb-4 text-center border-b border-indigo-100 pb-2">Análise Manual (Simulação)</h4>
          <div className="space-y-3 text-sm">
            <DreInput label="(+) Receita Bruta" val={manGross} onChange={v => handleManualUpdate('gross_revenue', v)} isBold />
            <DreInput label="(-) Fretes" val={manFreight} onChange={v => handleManualUpdate('freight', v)} isRed isSmall />
            <div className="flex justify-between border-t border-indigo-50 pt-1 font-semibold text-indigo-700 bg-indigo-50 px-1 rounded"><span>(=) Receita Líquida</span><span>{formatBRL(manNetRev)}</span></div>
            <DreInput label="(-) CMV (Custo)" val={manCMV} onChange={v => handleManualUpdate('cmv', v)} isRed />
            <div className="pl-2 border-l-2 border-indigo-100 space-y-2 mt-2">
               <DreInputRate label="Impostos" val={manRateTax} onChange={v => handleManualUpdate('tax_rate', v)} displayVal={manTaxes} />
               <DreInputRate label="Comissões" val={manRateComm} onChange={v => handleManualUpdate('comm_rate', v)} displayVal={manComms} />
               <div className="flex justify-between items-center text-xs opacity-70"><span className="text-slate-500">Inadimplência ({rateBad}%)</span><span className="text-red-500">{formatBRL(manBadDebt)}</span></div>
            </div>
            <div className="flex justify-between font-bold text-orange-700 mt-2 px-1"><span>(=) Margem Contrib.</span><div className="flex gap-2"><span className="text-[10px] bg-orange-100 px-1 rounded self-center">{formatPct(manNetRev ? manMargin/manNetRev*100 : 0)}</span><span>{formatBRL(manMargin)}</span></div></div>
            <div className="pl-2 space-y-2 mt-2">
              <DreInput label="(-) Desp. Fixas" val={manFixedExp} onChange={v => handleManualUpdate('fixed_expenses', v)} isSmall />
              <DreInput label="(-) Desp. Variáveis" val={manVarExp} onChange={v => handleManualUpdate('variable_expenses', v)} isSmall />
            </div>
            <div className="flex justify-between p-3 bg-indigo-50 rounded-lg border-2 border-indigo-200 mt-4 shadow-sm"><span className="font-extrabold text-indigo-900">LUCRO PROJETADO</span><div className="flex flex-col items-end"><span className={`font-extrabold text-lg ${manProfit >= 0 ? 'text-indigo-900' : 'text-red-600'}`}>{formatBRL(manProfit)}</span><span className="text-[10px] font-bold text-indigo-600">{formatPct(manProfitPct)}</span></div></div>
          </div>
        </div>
      </div>

      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        <h3 className="font-bold text-slate-700 mb-4 text-sm">Visualização Comparativa</h3>
        <div className="relative h-64"><Bar data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: '#f1f5f9' } } } }} /></div>
        <div className="flex justify-center gap-6 mt-4 text-xs font-bold"><span className="flex items-center gap-1"><div className="w-3 h-3 bg-slate-400 rounded-full"></div> Realizado</span><span className="flex items-center gap-1"><div className="w-3 h-3 bg-indigo-500 rounded-full"></div> Simulado</span></div>
      </div>
    </div>
  );
}

function DreRow({ label, value, isBold, isRed, isSmall }) {
  const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  return (
    <div className={`flex justify-between items-center ${isSmall ? 'text-xs text-slate-500' : ''}`}>
      <span className={isBold ? 'text-slate-600 font-medium' : ''}>{label}</span>
      <span className={`font-bold ${isRed ? 'text-red-400' : 'text-slate-800'}`}>{formatBRL(value)}</span>
    </div>
  );
}
function DreRowInput({ label, value, pct, isRed, isSmall }) {
  const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  return (
    <div className={`flex justify-between items-center ${isSmall ? 'text-xs text-slate-500' : ''} ${isRed ? 'bg-red-50 p-1 rounded border border-red-100' : ''}`}>
      <span>{label}</span><div className="flex gap-2"><span className={`text-[10px] px-1 rounded self-center ${isRed ? 'bg-red-100 text-red-700' : 'bg-slate-100'}`}>{pct.toFixed(1)}%</span><span className={isRed ? 'text-red-700 font-bold' : 'text-red-500'}>{formatBRL(value)}</span></div>
    </div>
  );
}
function DreInput({ label, val, onChange, isBold, isRed, isSmall }) {
  return (
    <div className={`flex justify-between items-center ${isSmall ? 'text-xs' : ''} ${isRed ? 'bg-red-50 p-1 rounded border border-red-100' : ''}`}>
      <span className={`${isBold ? 'text-slate-600 font-medium' : 'text-slate-500'} ${isRed ? 'text-red-700 font-bold' : ''}`}>{label}</span>
      <input type="number" value={val || 0} onChange={e => onChange(e.target.value)} className={`input-clean text-right bg-transparent border-b border-slate-300 w-24 focus:ring-0 focus:border-indigo-500 ${isRed ? 'text-red-700 font-bold' : 'text-indigo-900 font-bold'} ${isSmall ? 'text-xs' : ''} text-slate-900`} />
    </div>
  );
}
function DreInputRate({ label, val, onChange, displayVal }) {
  const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  return (
    <div className="flex justify-between items-center text-xs">
      <span className="text-slate-500">{label} (<input type="number" value={val} onChange={e => onChange(e.target.value)} className="w-8 text-center border-b border-slate-300 text-[10px] bg-transparent focus:outline-none focus:border-indigo-500 text-slate-900" />%)</span>
      <span className="text-red-500">{formatBRL(displayVal)}</span>
    </div>
  );
}