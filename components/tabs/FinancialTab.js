"use client";
import { useState, useMemo } from "react";
import { Settings, Calculator, Trash2, Plus, RefreshCw } from "lucide-react";

// Componente de linha do DRE
function DRESingleLine({ label, val, color, isInput, onChange, placeholder }) {
  const formatBRL = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  
  return (
    <div className="flex justify-between items-center text-xs text-slate-500 py-1.5 border-b border-slate-50 last:border-0">
      <span className="font-medium text-slate-600">{label}</span>
      {isInput ? (
        <input 
          type="number" 
          value={val || ''} 
          placeholder={placeholder ? placeholder.toFixed(2) : '0.00'}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="text-right w-24 bg-indigo-50 border-b border-indigo-300 focus:outline-none text-indigo-700 font-bold p-1 rounded-sm"
        />
      ) : (
        <span className={`${color} font-bold`}>{formatBRL(val)}</span>
      )}
    </div>
  );
}

export default function FinancialTab({ sales, selectedEndMonth, finParams, setFinParams, expenses, setExpenses }) {
  const [newExpense, setNewExpense] = useState({ name: "", val: "", type: "FIXED" });
  
  // Estado Local para o Simulador Manual
  const [manualScenario, setManualScenario] = useState({
    gross: null, freight: null, fixed: null, variable: null
  });

  const loadRealToSim = () => {
    // Copia os dados reais para o input manual
    setManualScenario({
      gross: financialData.realized.grossRev,
      freight: financialData.realized.freight,
      fixed: financialData.realized.fixedExp,
      variable: financialData.realized.varExp
    });
  };

  const financialData = useMemo(() => {
    // --- REALIZADO ---
    const targetData = sales.filter(s => s.date.substring(0, 7) === selectedEndMonth);
    const r_gross = targetData.reduce((a, b) => a + b.revenue + b.freight, 0);
    const r_freight = targetData.reduce((a, b) => a + b.freight, 0);
    const r_net = r_gross - r_freight;
    const r_cmv = targetData.reduce((a, b) => a + (b.cost || 0), 0);
    const r_cmv_pct = r_net > 0 ? r_cmv / r_net : 0; 

    const r_taxes = r_net * (finParams.tax / 100);
    const r_comm = r_net * (finParams.comm / 100);
    const r_bad = r_net * (finParams.badDebt / 100);
    const r_fixed = expenses.filter(e => e.type === 'FIXED').reduce((a,b) => a + b.val, 0);
    const r_var = expenses.filter(e => e.type === 'VARIABLE').reduce((a,b) => a + b.val, 0);
    const r_profit = (r_net - r_cmv - r_taxes - r_comm - r_bad) - r_fixed - r_var;

    // --- SIMULADO ---
    const s_gross = manualScenario.gross !== null ? manualScenario.gross : r_gross;
    const s_freight = manualScenario.freight !== null ? manualScenario.freight : r_freight;
    const s_net = s_gross - s_freight;
    const s_cmv = s_net * r_cmv_pct; 
    
    const s_taxes = s_net * (finParams.tax / 100);
    const s_comm = s_net * (finParams.comm / 100);
    const s_bad = s_net * (finParams.badDebt / 100);
    const s_fixed = manualScenario.fixed !== null ? manualScenario.fixed : r_fixed;
    const s_variable = manualScenario.variable !== null ? manualScenario.variable : r_var;
    
    const s_profit = (s_net - s_cmv - s_taxes - s_comm - s_bad) - s_fixed - s_variable;

    return {
      realized: { grossRev: r_gross, freight: r_freight, netRev: r_net, cmv: r_cmv, taxes: r_taxes, comm: r_comm, badDebt: r_bad, fixedExp: r_fixed, varExp: r_var, profit: r_profit },
      simulated: { grossRev: s_gross, freight: s_freight, netRev: s_net, cmv: s_cmv, taxes: s_taxes, comm: s_comm, badDebt: s_bad, fixedExp: s_fixed, varExp: s_variable, profit: s_profit }
    };
  }, [sales, selectedEndMonth, finParams, expenses, manualScenario]);

  const addExpense = () => {
    if (!newExpense.name || !newExpense.val) return;
    setExpenses([...expenses, { ...newExpense, id: Date.now(), val: parseFloat(newExpense.val) }]);
    setNewExpense({ name: "", val: "", type: "FIXED" });
  };

  const formatBRL = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <div className="space-y-6 fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* PARÂMETROS */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Settings className="w-4 h-4"/> Parâmetros Globais</h3>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="text-[10px] font-bold text-slate-500 uppercase">Impostos %</label><input type="number" value={finParams.tax} onChange={e => setFinParams({...finParams, tax: parseFloat(e.target.value)||0})} className="w-full border border-slate-300 rounded text-sm p-1.5"/></div>
            <div><label className="text-[10px] font-bold text-slate-500 uppercase">Comissão %</label><input type="number" value={finParams.comm} onChange={e => setFinParams({...finParams, comm: parseFloat(e.target.value)||0})} className="w-full border border-slate-300 rounded text-sm p-1.5"/></div>
            <div><label className="text-[10px] font-bold text-slate-500 uppercase text-red-600">Inadimplência %</label><input type="number" value={finParams.badDebt} onChange={e => setFinParams({...finParams, badDebt: parseFloat(e.target.value)||0})} className="w-full border border-slate-300 rounded text-sm p-1.5"/></div>
          </div>
        </div>
        
        {/* DESPESAS */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Calculator className="w-4 h-4"/> Despesas Extras</h3>
          <div className="flex gap-2">
            <input type="text" placeholder="Nome" value={newExpense.name} onChange={e => setNewExpense({...newExpense, name: e.target.value})} className="w-1/3 border border-slate-300 rounded text-xs p-2"/>
            <input type="number" placeholder="R$" value={newExpense.val} onChange={e => setNewExpense({...newExpense, val: e.target.value})} className="w-1/4 border border-slate-300 rounded text-xs p-2"/>
            <select value={newExpense.type} onChange={e => setNewExpense({...newExpense, type: e.target.value})} className="w-1/4 border border-slate-300 rounded text-xs p-2"><option value="FIXED">Fixa</option><option value="VARIABLE">Variável</option></select>
            <button onClick={addExpense} className="bg-cyan-600 text-white rounded px-3 hover:bg-cyan-700"><Plus size={16}/></button>
          </div>
          <div className="mt-2 space-y-1 max-h-20 overflow-y-auto custom-scroll">
            {expenses.map(exp => (
              <div key={exp.id} className="flex justify-between items-center text-xs bg-slate-50 p-2 rounded border border-slate-100">
                <span>{exp.name}</span>
                <div className="flex gap-2 items-center"><span className="font-bold text-red-500">- {formatBRL(exp.val)}</span><button onClick={() => setExpenses(expenses.filter(e => e.id !== exp.id))} className="text-slate-400 hover:text-red-500"><Trash2 size={12}/></button></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* DRE LADO A LADO */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
         <div className="flex justify-between items-center mb-6">
           <h3 className="font-bold text-slate-800 text-lg">DRE Comparativo: {selectedEndMonth}</h3>
           <button onClick={loadRealToSim} className="text-xs flex items-center gap-1 text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded hover:bg-indigo-100 transition"><RefreshCw size={12}/> Copiar Real para Simulado</button>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           
           {/* REALIZADO */}
           <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
             <h4 className="font-bold text-slate-500 uppercase text-xs mb-4 text-center border-b pb-2">Sistema (Real)</h4>
             <div className="space-y-1">
               <DRESingleLine label="(+) Faturamento" val={financialData.realized.grossRev} color="text-slate-800"/>
               <DRESingleLine label="(-) Fretes" val={financialData.realized.freight} color="text-red-400"/>
               <DRESingleLine label="(=) Rec. Líquida" val={financialData.realized.netRev} color="text-blue-700"/>
               <div className="pl-2 border-l-2 border-slate-200 mt-2">
                 <DRESingleLine label="(-) CMV" val={financialData.realized.cmv} color="text-red-600"/>
                 <DRESingleLine label="(-) Impostos" val={financialData.realized.taxes} color="text-red-500"/>
                 <DRESingleLine label="(-) Comissões" val={financialData.realized.comm} color="text-red-500"/>
               </div>
               <div className="mt-4 p-3 bg-white rounded border border-slate-200 flex justify-between items-center">
                 <span className="font-bold text-slate-600">LUCRO REAL</span>
                 <span className={`font-extrabold text-lg ${financialData.realized.profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>{formatBRL(financialData.realized.profit)}</span>
               </div>
             </div>
           </div>

           {/* SIMULADO */}
           <div className="bg-white p-6 rounded-xl border-2 border-indigo-100 relative shadow-inner">
              <div className="absolute top-0 right-0 bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-1 rounded-bl-lg">EDITÁVEL</div>
              <h4 className="font-bold text-indigo-600 uppercase text-xs mb-4 text-center border-b border-indigo-100 pb-2">Simulação</h4>
              <div className="space-y-1">
                <DRESingleLine label="(+) Faturamento" isInput={true} val={manualScenario.gross} onChange={v => setManualScenario({...manualScenario, gross: v})} placeholder={financialData.realized.grossRev}/>
                <DRESingleLine label="(-) Fretes" isInput={true} val={manualScenario.freight} onChange={v => setManualScenario({...manualScenario, freight: v})} placeholder={financialData.realized.freight}/>
                <DRESingleLine label="(=) Rec. Líquida" val={financialData.simulated.netRev} color="text-indigo-700"/>
                <div className="pl-2 border-l-2 border-indigo-100 mt-2 opacity-70">
                   <DRESingleLine label="(-) CMV (Estimado)" val={financialData.simulated.cmv} color="text-red-600"/>
                   <DRESingleLine label="(-) Impostos (Calc)" val={financialData.simulated.taxes} color="text-red-500"/>
                   <DRESingleLine label="(-) Comissões (Calc)" val={financialData.simulated.comm} color="text-red-500"/>
                </div>
                <div className="pl-2 border-l-2 border-indigo-100 mt-2">
                   <DRESingleLine label="(-) Desp. Fixas" isInput={true} val={manualScenario.fixed} onChange={v => setManualScenario({...manualScenario, fixed: v})} placeholder={financialData.realized.fixedExp}/>
                   <DRESingleLine label="(-) Desp. Variáveis" isInput={true} val={manualScenario.variable} onChange={v => setManualScenario({...manualScenario, variable: v})} placeholder={financialData.realized.varExp}/>
                </div>
                <div className="mt-4 p-3 bg-indigo-50 rounded border border-indigo-200 flex justify-between items-center">
                 <span className="font-bold text-indigo-900">LUCRO PROJETADO</span>
                 <span className={`font-extrabold text-lg ${financialData.simulated.profit >= 0 ? 'text-indigo-700' : 'text-red-600'}`}>{formatBRL(financialData.simulated.profit)}</span>
               </div>
              </div>
           </div>

         </div>
      </div>
    </div>
  );
}