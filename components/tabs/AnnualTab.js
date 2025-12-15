"use client";

import { useState, useMemo } from 'react';
import { CalendarRange, Printer } from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export default function AnnualTab({ summary, settings, expenses, scenarios }) {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [viewMode, setViewMode] = useState('SYSTEM'); // 'SYSTEM' ou 'MANUAL'

  // 1. Extrair anos disponíveis
  const availableYears = useMemo(() => {
    const years = new Set(summary.map(s => s.year));
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a); // Decrescente
  }, [summary]);

  // 2. Processamento dos Dados Anuais (O Coração da Lógica)
  const annualData = useMemo(() => {
    const months = [];
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    for (let i = 1; i <= 12; i++) {
      const monthKey = `${selectedYear}-${i}`;
      
      // Dados do Sistema (Realizado)
      const sysData = summary.find(s => s.year === parseInt(selectedYear) && s.month === i);
      const manualData = scenarios.find(s => s.month_key === monthKey);

      // Valores Base
      let grossRev = sysData ? (sysData.total_revenue || 0) : 0;
      let cmv = sysData ? (sysData.total_cost || 0) : 0;
      let freight = 0; // Se tiver coluna de frete, adicionar aqui
      
      // Taxas
      let taxRate = settings.tax_rate;
      let commRate = settings.comm_rate;
      let badDebtRate = settings.bad_debt_rate;

      // Despesas
      let fixedExp = expenses.filter(e => e.type === 'FIXED').reduce((a, b) => a + Number(b.value), 0);
      let varExp = expenses.filter(e => e.type === 'VARIABLE' && e.month_key === monthKey).reduce((a, b) => a + Number(b.value), 0);

      const hasSystemData = !!sysData;
      const hasManualData = !!manualData;

      // OVERRIDE: Se estiver em modo MANUAL e existir cenário salvo
      if (viewMode === 'MANUAL' && hasManualData) {
        grossRev = Number(manualData.gross_revenue);
        freight = Number(manualData.freight);
        cmv = Number(manualData.cmv);
        taxRate = Number(manualData.tax_rate);
        commRate = Number(manualData.comm_rate);
        fixedExp = Number(manualData.fixed_expenses);
        varExp = Number(manualData.variable_expenses);
        // Inadimplência geralmente mantém a global se não tiver override específico
      }

      // Cálculos Finais
      const netRev = grossRev - freight;
      const taxes = netRev * (taxRate / 100);
      const commissions = netRev * (commRate / 100);
      const badDebt = netRev * (badDebtRate / 100);
      
      const deductions = taxes + commissions + badDebt;
      const margin = netRev - cmv - deductions;
      const totalExpenses = fixedExp + varExp;
      const profit = margin - totalExpenses;
      const profitMargin = netRev > 0 ? (profit / netRev) * 100 : 0;

      months.push({
        monthName: monthNames[i - 1],
        grossRev,
        cmv,
        deductions,
        margin,
        expenses: totalExpenses,
        profit,
        profitMargin,
        hasData: viewMode === 'MANUAL' ? (hasSystemData || hasManualData) : hasSystemData
      });
    }
    return months;
  }, [summary, settings, expenses, scenarios, selectedYear, viewMode]);

  // 3. Dados do Gráfico
  const chartData = {
    labels: annualData.map(d => d.monthName.substr(0, 3)), // Jan, Fev...
    datasets: [{
      label: 'Saldo Líquido (R$)',
      data: annualData.map(d => d.hasData ? d.profit : null),
      backgroundColor: annualData.map(d => d.profit >= 0 ? '#22c55e' : '#ef4444'),
      borderRadius: 4,
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { 
      y: { grid: { color: '#f1f5f9' }, beginAtZero: true },
      x: { grid: { display: false } }
    }
  };

  // 4. Totais da Tabela
  const totals = annualData.reduce((acc, curr) => ({
    gross: acc.gross + curr.grossRev,
    cmv: acc.cmv + curr.cmv,
    ded: acc.ded + curr.deductions,
    marg: acc.marg + curr.margin,
    exp: acc.exp + curr.expenses,
    prof: acc.prof + curr.profit
  }), { gross: 0, cmv: 0, ded: 0, marg: 0, exp: 0, prof: 0 });

  const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="space-y-6 fade-in pb-10">
      {/* Header e Controles */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <CalendarRange className="text-purple-600" size={24} /> 
            Análise de Saldo Anual
          </h2>
          
          <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
            {/* Seletor de Modo */}
            <div className="flex items-center px-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase mr-2">Visualização:</label>
              <select 
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value)}
                className="bg-transparent border-none text-sm font-bold text-purple-800 cursor-pointer focus:ring-0 py-0"
              >
                <option value="SYSTEM">Dados do Sistema (Realizado)</option>
                <option value="MANUAL">Simulação Manual (Cenário)</option>
              </select>
            </div>
            
            <div className="w-px h-6 bg-slate-300"></div>

            {/* Seletor de Ano */}
            <div className="flex items-center px-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase mr-2">Ano:</label>
              <select 
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="bg-transparent border-none text-sm font-bold text-purple-800 cursor-pointer focus:ring-0 py-0"
              >
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Gráfico de Barras */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="font-bold text-slate-700 mb-4 text-sm uppercase tracking-wide flex justify-between items-center">
          <span>Saldo Líquido Mensal (Lucro vs Prejuízo)</span>
          <span className={`text-[10px] px-2 py-1 rounded ${viewMode === 'MANUAL' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
            Modo: {viewMode === 'MANUAL' ? 'Simulação Manual' : 'Realizado'}
          </span>
        </h3>
        <div className="relative h-80">
          <Bar data={chartData} options={chartOptions} />
        </div>
        <div className="mt-4 flex justify-center gap-4 text-xs text-slate-500 font-medium">
          <span className="flex items-center gap-1"><div className="w-3 h-3 bg-green-500 rounded-sm"></div> Saldo Positivo</span>
          <span className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500 rounded-sm"></div> Saldo Negativo (Atenção)</span>
        </div>
      </div>

      {/* Tabela DRE Anual */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <h3 className="font-bold text-slate-700 text-sm">Demonstrativo de Resultado (DRE) Detalhado</h3>
          <button 
            onClick={() => window.print()} 
            className="text-xs flex items-center gap-1 text-slate-500 hover:text-slate-800 font-medium"
          >
            <Printer size={14} /> Imprimir Relatório
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right whitespace-nowrap">
            <thead className="bg-slate-100 text-slate-600 font-bold uppercase border-b border-slate-200">
              <tr>
                <th className="p-3 text-left sticky left-0 bg-slate-100 z-10 w-24 border-r border-slate-200">Mês</th>
                <th className="p-3 text-slate-800 bg-blue-50">Faturamento</th>
                <th className="p-3 text-red-500">(-) Custos (CMV)</th>
                <th className="p-3 text-red-500">(-) Imp/Com/Inad</th>
                <th className="p-3 text-orange-600 bg-orange-50">Margem Contrib.</th>
                <th className="p-3 text-red-500">(-) Despesas Op.</th>
                <th className="p-3 text-slate-800 bg-gray-50 border-l border-slate-200">Lucro Líquido</th>
                <th className="p-3 text-slate-500">% Mg</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {annualData.map((d, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 text-left font-bold text-slate-700 bg-white sticky left-0 border-r border-slate-100">
                    {d.monthName}
                  </td>
                  <td className="p-3 text-slate-900 bg-blue-50/30 font-medium">
                    {d.grossRev > 0 ? formatBRL(d.grossRev) : '-'}
                  </td>
                  <td className="p-3 text-red-400">
                    {d.cmv > 0 ? '- '+formatBRL(d.cmv) : '-'}
                  </td>
                  <td className="p-3 text-red-400 text-[10px]">
                    {d.deductions > 0 ? '- '+formatBRL(d.deductions) : '-'}
                  </td>
                  <td className="p-3 text-orange-700 font-bold bg-orange-50/30">
                    {formatBRL(d.margin)}
                  </td>
                  <td className="p-3 text-red-600 font-medium">
                    {d.expenses > 0 ? '- '+formatBRL(d.expenses) : '-'}
                  </td>
                  <td className={`p-3 font-bold border-l border-slate-200 ${d.profit >= 0 ? 'text-green-600 bg-green-50/30' : 'text-red-600 bg-red-50/30'}`}>
                    {formatBRL(d.profit)}
                  </td>
                  <td className={`p-3 text-center text-[10px] font-bold ${d.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {d.profitMargin.toFixed(1)}%
                  </td>
                </tr>
              ))}
              
              {/* Linha de Total */}
              <tr className="bg-slate-100 font-bold text-slate-800 border-t-2 border-slate-200 text-sm">
                <td className="p-3 text-left sticky left-0 bg-slate-100 border-r border-slate-200">TOTAL ANO</td>
                <td className="p-3 text-slate-900 bg-blue-100">{formatBRL(totals.gross)}</td>
                <td className="p-3 text-red-600">{formatBRL(totals.cmv)}</td>
                <td className="p-3 text-red-600">{formatBRL(totals.ded)}</td>
                <td className="p-3 text-orange-800 bg-orange-100">{formatBRL(totals.marg)}</td>
                <td className="p-3 text-red-800">{formatBRL(totals.exp)}</td>
                <td className={`p-3 border-l border-slate-300 text-base ${totals.prof >= 0 ? 'text-green-800 bg-green-200' : 'text-red-800 bg-red-200'}`}>
                  {formatBRL(totals.prof)}
                </td>
                <td className="p-3 text-center text-xs">-</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}