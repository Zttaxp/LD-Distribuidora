"use client";

import { useState, useMemo } from 'react';
import { CalendarRange, Printer } from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function AnnualTab({ summary, settings, expenses, scenarios }) {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [viewMode, setViewMode] = useState('SYSTEM');

  const availableYears = useMemo(() => {
    const years = new Set(summary.map(s => s.year));
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [summary]);

  const annualData = useMemo(() => {
    const months = [];
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

    for (let i = 1; i <= 12; i++) {
      const monthKey = `${selectedYear}-${i}`;
      const sysData = summary.find(s => s.year === parseInt(selectedYear) && s.month === i);
      const manualData = scenarios.find(s => s.month_key === monthKey);

      // --- DEFINIÇÃO CHAVE: DADOS DO BANCO ---
      // total_net_revenue = Soma dos 'revenue' (Já limpo: Unitario ou Total se tiver desconto)
      const sysNetRev = sysData ? Number(sysData.total_net_revenue || 0) : 0;
      // total_freight = Soma dos 'freight'
      const sysFreight = sysData ? Number(sysData.total_freight || 0) : 0;
      
      const sysCMV = sysData ? Number(sysData.total_cost || 0) : 0;

      const isManualMode = viewMode === 'MANUAL';
      
      // Seletor Manual vs Sistema
      let netRev = sysNetRev; // Faturamento Bruto da Venda (Base)
      let freight = sysFreight;
      let cmv = sysCMV;
      let taxRate = Number(settings.tax_rate) || 0;
      let commRate = Number(settings.comm_rate) || 0;
      let badDebtRate = Number(settings.bad_debt_rate) || 0;

      let fixedExp = expenses.filter(e => e.type === 'FIXED').reduce((a, b) => a + Number(b.value), 0);
      let varExp = expenses.filter(e => e.type === 'VARIABLE' && e.month_key === monthKey).reduce((a, b) => a + Number(b.value), 0);

      if (isManualMode && manualData) {
        netRev = Number(manualData.gross_revenue); // Base
        freight = Number(manualData.freight);
        cmv = Number(manualData.cmv);
        taxRate = Number(manualData.tax_rate);
        commRate = Number(manualData.comm_rate);
        fixedExp = Number(manualData.fixed_expenses);
        varExp = Number(manualData.variable_expenses);
      }

      // --- CÁLCULOS DRE ---
      // Impostos e Comissões incidem sobre a VENDA (netRev), não sobre Frete
      const taxes = netRev * (taxRate / 100);
      const commissions = netRev * (commRate / 100);
      const badDebt = netRev * (badDebtRate / 100);
      
      // Margem Contrib = Venda - Custo - Impostos
      const margin = netRev - cmv - taxes - commissions - badDebt;
      
      const totalExpenses = fixedExp + varExp;
      const profit = margin - totalExpenses;
      const profitMargin = netRev > 0 ? (profit / netRev) * 100 : 0;

      months.push({
        monthName: monthNames[i - 1],
        netRev,   // Base
        freight,
        totalNote: netRev + freight, // Bruto Total
        cmv,
        deductions: taxes + commissions + badDebt,
        margin,
        expenses: totalExpenses,
        profit,
        profitMargin,
        hasData: isManualMode ? (sysData || manualData) : !!sysData
      });
    }
    return months;
  }, [summary, settings, expenses, scenarios, selectedYear, viewMode]);

  const chartData = {
    labels: annualData.map(d => d.monthName),
    datasets: [{ label: 'Saldo Líquido (R$)', data: annualData.map(d => d.hasData ? d.profit : null), backgroundColor: annualData.map(d => d.profit >= 0 ? '#22c55e' : '#ef4444'), borderRadius: 4 }]
  };

  const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="space-y-6 fade-in pb-10">
      {/* HEADER */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><CalendarRange className="text-purple-600" size={24} /> Análise de Saldo Anual</h2>
          <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
            <div className="flex items-center px-2"><label className="text-[10px] font-bold text-slate-500 uppercase mr-2">Visualização:</label><select value={viewMode} onChange={(e) => setViewMode(e.target.value)} className="bg-transparent border-none text-sm font-bold text-purple-800 cursor-pointer focus:ring-0 py-0"><option value="SYSTEM">Dados do Sistema (Realizado)</option><option value="MANUAL">Simulação Manual (Cenário)</option></select></div>
            <div className="w-px h-6 bg-slate-300"></div>
            <div className="flex items-center px-2"><label className="text-[10px] font-bold text-slate-500 uppercase mr-2">Ano:</label><select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="bg-transparent border-none text-sm font-bold text-purple-800 cursor-pointer focus:ring-0 py-0">{availableYears.map(y => <option key={y} value={y}>{y}</option>)}</select></div>
          </div>
        </div>
      </div>
      
      {/* GRÁFICO */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="font-bold text-slate-700 mb-4 text-sm uppercase tracking-wide flex justify-between items-center"><span>Saldo Líquido Mensal</span></h3>
        <div className="relative h-80"><Bar data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { grid: { color: '#f1f5f9' }, beginAtZero: true }, x: { grid: { display: false } } } }} /></div>
      </div>
      
      {/* TABELA DRE COMPLETA */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center"><h3 className="font-bold text-slate-700 text-sm">Demonstrativo Detalhado (DRE)</h3><button onClick={() => window.print()} className="text-xs flex items-center gap-1 text-slate-500 hover:text-slate-800 font-medium"><Printer size={14} /> Imprimir</button></div>
        <div className="overflow-x-auto">
           <table className="w-full text-xs text-right whitespace-nowrap">
             <thead className="bg-slate-100 text-slate-600 font-bold uppercase border-b border-slate-200">
               <tr>
                 <th className="p-3 text-left sticky left-0 bg-slate-100 z-10 w-24 border-r border-slate-200">Mês</th>
                 <th className="p-3 text-slate-500">Total Nota</th>
                 <th className="p-3 text-orange-400">(-) Fretes</th>
                 <th className="p-3 text-slate-800 bg-blue-50 border-x border-blue-100" title="Base de Cálculo">Fat. Bruto (Pedra)</th>
                 <th className="p-3 text-red-500">(-) CMV</th>
                 <th className="p-3 text-red-500">(-) Ded. Var.</th>
                 <th className="p-3 text-orange-600 bg-orange-50">Mg. Contrib.</th>
                 <th className="p-3 text-red-500">(-) Desp. Fixas</th>
                 <th className="p-3 text-slate-800 bg-gray-50 border-l border-slate-200">Lucro Líq.</th>
                 <th className="p-3 text-slate-500">%</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-slate-100 text-slate-600">
               {annualData.map((d, i) => (
                 <tr key={i} className="hover:bg-slate-50 transition-colors">
                   <td className="p-3 text-left font-bold text-slate-700 bg-white sticky left-0 border-r border-slate-100">{d.monthName}</td>
                   <td className="p-3 text-slate-400">{d.totalNote > 0 ? formatBRL(d.totalNote) : '-'}</td>
                   <td className="p-3 text-orange-400 text-[10px]">{d.freight > 0 ? '- '+formatBRL(d.freight) : '-'}</td>
                   <td className="p-3 text-blue-700 font-bold bg-blue-50/30 border-x border-blue-50">{d.netRev > 0 ? formatBRL(d.netRev) : '-'}</td>
                   <td className="p-3 text-red-400">{d.cmv > 0 ? '- '+formatBRL(d.cmv) : '-'}</td>
                   <td className="p-3 text-red-400 text-[10px]">{d.deductions > 0 ? '- '+formatBRL(d.deductions) : '-'}</td>
                   <td className="p-3 text-orange-700 font-bold bg-orange-50/30">{formatBRL(d.margin)}</td>
                   <td className="p-3 text-red-600 font-medium">{d.expenses > 0 ? '- '+formatBRL(d.expenses) : '-'}</td>
                   <td className={`p-3 font-bold border-l border-slate-200 ${d.profit >= 0 ? 'text-green-600 bg-green-50/30' : 'text-red-600 bg-red-50/30'}`}>{formatBRL(d.profit)}</td>
                   <td className={`p-3 text-center text-[10px] font-bold ${d.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>{d.profitMargin.toFixed(1)}%</td>
                 </tr>
               ))}
             </tbody>
           </table>
        </div>
      </div>
    </div>
  );
}