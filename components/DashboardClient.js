"use client";

import { useState, useRef, useMemo, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { parseExcelData } from '@/lib/parser';
import { 
  LayoutDashboard, DollarSign, FileText, Users, Upload, Loader2, LogOut, FileSpreadsheet 
} from 'lucide-react';

import OverviewTab from '@/components/tabs/OverviewTab';
import FinancialTab from '@/components/tabs/FinancialTab';
import AnnualTab from '@/components/tabs/AnnualTab';
import SellersTab from '@/components/tabs/SellersTab';

export default function DashboardClient({ 
  initialSummary, 
  initialTopMaterials, 
  initialSellers,
  initialSettings,
  initialExpenses,
  initialScenarios,
  userProfile,
  datasets = [],        // Nova prop: Lista de arquivos
  currentDatasetId      // Nova prop: Arquivo atual
}) {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const isSeller = userProfile?.role === 'vendedor';

  const [activeTab, setActiveTab] = useState(isSeller ? 'sellers' : 'overview');
  const [isUploading, setIsUploading] = useState(false);
  
  // --- STATE DO DATASET ---
  // Quando muda o select, damos um push na URL para recarregar os dados
  const handleDatasetChange = (e) => {
    const newId = e.target.value;
    router.push(`/?datasetId=${newId}`);
  };

  const summaryData = initialSummary || [];
  const topMaterials = initialTopMaterials || [];
  
  // Filtro de Vendedores
  const sellersData = useMemo(() => {
    const allSellers = initialSellers || [];
    if (isSeller) {
      const profileName = (userProfile?.name || "").toLowerCase().trim();
      return allSellers.filter(s => {
        // Nota: A view nova no SQL já retorna 'name', mas mantemos compatibilidade
        const sellerNameFromDB = (s.name || s.seller || "").toLowerCase().trim();
        return sellerNameFromDB === profileName;
      });
    }
    return allSellers;
  }, [initialSellers, isSeller, userProfile]);
  
  const [settings, setSettings] = useState(initialSettings || { tax_rate: 6, comm_rate: 3, bad_debt_rate: 0 });
  const [expenses, setExpenses] = useState(initialExpenses || []);
  const manualScenarios = initialScenarios || []; 
  const fileInputRef = useRef(null);

 const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      console.log("1. Iniciando Upload...");
      const fileName = `${Date.now()}_${file.name}`;
      
      // Upload do arquivo físico
      const { error: uploadError } = await supabase.storage.from('uploads').upload(fileName, file);
      if (uploadError) console.warn("Aviso Storage:", uploadError.message);

      // Cria o registro do Dataset
      const { data: datasetData, error: datasetError } = await supabase
        .from('datasets')
        .insert([{ name: file.name, uploaded_at: new Date() }])
        .select().single();

      if (datasetError) throw new Error(`Erro ao criar Dataset: ${datasetError.message}`);
      console.log("2. Dataset Criado com ID:", datasetData.id);

      // Lê o Excel
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
      
      console.log("3. Linhas brutas no Excel:", jsonData.length);
      if (jsonData.length > 0) {
          console.log("   Exemplo da primeira linha bruta:", jsonData[0]);
      }

      // Processa os dados
      const parsedSales = parseExcelData(jsonData, datasetData.id);
      console.log("4. Linhas Válidas após Parser:", parsedSales.length);

      if (parsedSales.length === 0) {
          alert("ERRO CRÍTICO: O Excel foi lido, mas nenhuma linha foi considerada válida.\n\nVerifique se as colunas 'Data' e 'Valor' (ou PrecoUnit) existem na planilha.");
          throw new Error("Parser retornou 0 vendas.");
      }

      console.log("   Exemplo de venda processada:", parsedSales[0]);

      // Insere em lotes (Chunks)
      const chunkSize = 1000;
      let insertedCount = 0;
      for (let i = 0; i < parsedSales.length; i += chunkSize) {
        const chunk = parsedSales.slice(i, i + chunkSize);
        const { error: insertError } = await supabase.from('sales').insert(chunk);
        if (insertError) {
            console.error("Erro ao inserir lote:", insertError);
            throw insertError;
        }
        insertedCount += chunk.length;
        console.log(`   Inserido lote: ${insertedCount} / ${parsedSales.length}`);
      }

      alert(`Sucesso! ${insertedCount} vendas importadas.`);
      
      // Força atualização da página
      router.push(`/?datasetId=${datasetData.id}`); 
      router.refresh();

    } catch (error) {
      console.error("Erro Geral:", error);
      alert(`Erro: ${error.message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const renderContent = () => {
    if (isSeller && activeTab !== 'sellers') return <SellersTab sellers={sellersData} settings={settings} currentUser={userProfile} />;

    switch (activeTab) {
      case 'overview': return <OverviewTab summary={summaryData} topMaterials={topMaterials} settings={settings} expenses={expenses} />;
      case 'financial': return <FinancialTab summary={summaryData} settings={settings} expenses={expenses} onSettingsChange={setSettings} onExpensesChange={setExpenses} />;
      case 'annual': return <AnnualTab summary={summaryData} settings={settings} expenses={expenses} scenarios={manualScenarios} />;
      case 'sellers': return <SellersTab sellers={sellersData} settings={settings} currentUser={userProfile} />;
      default: return <OverviewTab summary={summaryData} topMaterials={topMaterials} />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col shadow-sm z-10">
        <div className="p-6 border-b border-slate-100 flex flex-col gap-4">
          <div className="flex items-center gap-2">
             <div className="bg-cyan-600 text-white p-1.5 rounded-lg font-bold shadow-sm">BI</div>
             <div>
               <h1 className="text-lg font-bold text-slate-800 leading-tight">Marmoraria</h1>
               <p className="text-xs text-slate-500">{userProfile?.name} ({isSeller ? 'Vendedor' : 'Diretoria'})</p>
             </div>
          </div>

          {/* --- SELETOR DE DATASET (NOVO) --- */}
          <div className="w-full">
            <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center gap-1">
              <FileSpreadsheet size={12}/> Arquivo Ativo
            </label>
            <select 
              value={currentDatasetId || ""} 
              onChange={handleDatasetChange}
              className="w-full text-xs p-2 rounded border border-slate-200 bg-slate-50 font-medium text-slate-700 focus:outline-none focus:border-cyan-500"
            >
              {datasets.length === 0 && <option value="">Nenhum arquivo</option>}
              {datasets.map(ds => (
                <option key={ds.id} value={ds.id}>
                  {ds.name} ({new Date(ds.uploaded_at).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {!isSeller && (
            <>
              <SidebarItem icon={<LayoutDashboard size={20} />} label="Visão Geral" active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
              <SidebarItem icon={<DollarSign size={20} />} label="Simulador" active={activeTab === 'financial'} onClick={() => setActiveTab('financial')} />
              <SidebarItem icon={<FileText size={20} />} label="Relatório Anual" active={activeTab === 'annual'} onClick={() => setActiveTab('annual')} />
            </>
          )}
          <SidebarItem icon={<Users size={20} />} label="Vendedores" active={activeTab === 'sellers'} onClick={() => setActiveTab('sellers')} />
        </nav>

        <div className="p-4 border-t border-slate-100 space-y-3">
          {!isSeller && (
            <div className="relative">
              <input type="file" accept=".xlsx, .xls" className="hidden" ref={fileInputRef} onChange={handleFileUpload} disabled={isUploading} />
              <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className={`w-full flex items-center justify-center gap-2 p-3 rounded-lg text-sm font-bold transition-all shadow-sm ${isUploading ? 'bg-slate-100 text-slate-400' : 'bg-cyan-600 text-white hover:bg-cyan-700'}`}>
                {isUploading ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
                {isUploading ? 'Carregando...' : 'Nova Planilha'}
              </button>
            </div>
          )}
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 p-2 text-sm text-red-500 hover:bg-red-50 rounded-lg font-medium"><LogOut size={16} /> Sair</button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto custom-scroll">
        <header className="bg-white border-b border-slate-200 p-4 flex justify-between items-center md:hidden sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <div className="bg-cyan-600 text-white p-1 rounded font-bold text-xs">BI</div>
            <select 
              value={currentDatasetId || ""} 
              onChange={handleDatasetChange}
              className="text-xs p-1 rounded border border-slate-200 bg-white max-w-[150px]"
            >
              {datasets.map(ds => <option key={ds.id} value={ds.id}>{ds.name}</option>)}
            </select>
          </div>
          <button onClick={handleLogout} className="text-xs text-red-600 font-bold">Sair</button>
        </header>
        <div className="p-4 md:p-8 max-w-7xl mx-auto">{renderContent()}</div>
      </main>
    </div>
  );
}

function SidebarItem({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm font-medium transition-all ${active ? 'bg-cyan-50 text-cyan-700 border-r-4 border-cyan-600 font-bold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
      <span className={active ? 'text-cyan-600' : 'text-slate-400'}>{icon}</span> {label}
    </button>
  );
}