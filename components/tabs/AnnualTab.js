"use client";
import { useState, useMemo } from "react";
import { CalendarRange } from "lucide-react";
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function AnnualTab({ sales, selectedYear, setSelectedYear, finParams }) {
  const [viewMode, setViewMode] = useState("SYSTEM"); 

  const annualData = useMemo(() => {
    const yearSales = sales.filter(s => parseInt(s.date.substring(0, 4)) === selectedYear);
    const dataByMonth = [];
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

    for (let i = 0; i < 12; i++) {
      const mStr = `${selectedYear}-${String(i+1).padStart(2,'0')}`;
      const mSales = yearSales.filter(s => s.date.substring(0,7) === mStr);
      
      let gross = mSales.reduce((a,b) => a + b.revenue + b.freight, 0);
      let cost = mSales.reduce((a,b) => a + (b.cost||0), 0);
      let profit = 0;

      if (viewMode === 'SYSTEM') {
        profit = mSales.reduce((a, b) => a + (b.revenue - (b.cost || 0)), 0);
      } else {
        const netRev = gross; 
        const taxes = netRev * (finParams.tax / 100);
        const comm = netRev * (finParams.comm / 100);
        const bad = netRev * (finParams.badDebt / 100);
        profit = netRev - cost - taxes - comm - bad;
      }
      
      dataByMonth.push({ name: monthNames[i], gross, cost, profit });
    }
    return dataByMonth;
  }, [sales, selectedYear, finParams, viewMode]);

  const formatBRL = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <div className="space-y-6 fade-in">
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <CalendarRange className="text-purple-600"/> Análise Anual
        </h2>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
            <button 
              onClick={() => setViewMode('SYSTEM')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'SYSTEM' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}
            >
              Dados Sistema
            </button>
            <button 
              onClick={() => setViewMode('SCENARIO')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'SCENARIO' ? 'bg-purple-100 text-purple-700' : 'text-slate-500'}`}
            >
              Cenário Editável
            </button>
          </div>

          <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} className="bg-slate-100 border-none rounded p-2 font-bold text-slate-700 cursor-pointer">
            {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="font-bold text-slate-700 mb-4 text-sm uppercase">Saldo Líquido Mensal ({viewMode === 'SYSTEM' ? 'Real' : 'Simulado'})</h3>
        <div className="h-64 w-full">
          <Bar 
            data={{
              labels: annualData.map(d => d.name),
              datasets: [{
                label: viewMode === 'SYSTEM' ? 'Lucro Real' : 'Lucro Simulado',
                data: annualData.map(d => d.profit),
                backgroundColor: annualData.map(d => d.profit >= 0 ? '#22c55e' : '#ef4444'),
                borderRadius: 4
              }]
            }} 
            options={{ maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }} 
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="max-h-[400px] overflow-auto custom-scroll">
          <table className="w-full text-xs text-right whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200 sticky top-0 z-10">
              <tr><th className="p-3 text-left">Mês</th><th className="p-3 text-blue-700">Faturamento</th><th className="p-3 text-red-500">(-) Custos</th><th className="p-3 text-green-700 bg-green-50">Lucro Líq.</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {annualData.map((d, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="p-3 text-left font-bold text-slate-700">{d.name}</td>
                  <td className="p-3">{formatBRL(d.gross)}</td>
                  <td className="p-3 text-red-500">{formatBRL(d.cost)}</td>
                  <td className={`p-3 font-bold ${d.profit>=0?'text-green-600':'text-red-600'}`}>{formatBRL(d.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}