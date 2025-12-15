"use client";

import { useState, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { parseExcelData } from '@/lib/parser';
import { 
  LayoutDashboard, 
  DollarSign, 
  FileText, 
  Users, 
  Upload, 
  Loader2,
  LogOut 
} from 'lucide-react';

// Imports dos Componentes de Abas
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
  initialScenarios // <--- NOVO: Recebe os cenários manuais do banco
}) {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  // Estados de Navegação e UI
  const [activeTab, setActiveTab] = useState('overview');
  const [isUploading, setIsUploading] = useState(false);
  
  // Dados vindos do Servidor (Server Components)
  const summaryData = initialSummary || [];
  const topMaterials = initialTopMaterials || [];
  const sellersData = initialSellers || [];
  
  // Dados que podem ser atualizados localmente (Financeiro)
  const [settings, setSettings] = useState(initialSettings || { tax_rate: 6, comm_rate: 3, bad_debt_rate: 0 });
  const [expenses, setExpenses] = useState(initialExpenses || []);
  
  // Cenários para o Relatório Anual (Somente Leitura aqui, edição é na aba Financeiro)
  const manualScenarios = initialScenarios || []; 

  const fileInputRef = useRef(null);

  // --- LÓGICA DE UPLOAD (MANTIDA IGUAL AO HTML ORIGINAL) ---
  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      console.log("--- INICIANDO UPLOAD ---");
      console.log("1. Arquivo selecionado:", file.name, `(${file.size} bytes)`);

      // 1. Salvar arquivo no Storage (Backup)
      const fileName = `${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(fileName, file);

      if (uploadError) {
        console.warn("Aviso: Upload para Storage falhou, mas seguindo com banco de dados.", uploadError);
      } else {
        console.log("2. Upload no Storage concluído.");
      }

      // 2. Criar registro do dataset
      const { data: datasetData, error: datasetError } = await supabase
        .from('datasets')
        .insert([{ name: file.name, uploaded_at: new Date() }])
        .select()
        .single();

      if (datasetError) throw new Error(`Falha ao registrar dataset: ${datasetError.message}`);
      console.log("3. Dataset registrado. ID:", datasetData.id);

      // 3. Ler e Parsear Excel
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // IMPORTANTE: { defval: "" } garante compatibilidade com a lógica do HTML original
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
      
      console.log(`4. Leitura do Excel concluída. Linhas brutas: ${jsonData.length}`);

      if (jsonData.length === 0) {
        throw new Error("A planilha parece estar vazia.");
      }

      // Processa os dados
      const parsedSales = parseExcelData(jsonData, datasetData.id);
      console.log(`5. Parser concluído. Linhas válidas para inserção: ${parsedSales.length}`);

      if (parsedSales.length === 0) {
        throw new Error("Nenhuma venda válida encontrada. Verifique se as colunas da planilha correspondem ao padrão.");
      }

      // 4. Inserir vendas em lotes (Chunks)
      console.log("6. Iniciando inserção no banco...");
      const chunkSize = 1000;
      let insertedCount = 0;

      for (let i = 0; i < parsedSales.length; i += chunkSize) {
        const chunk = parsedSales.slice(i, i + chunkSize);
        const { error: insertError } = await supabase.from('sales').insert(chunk);
        
        if (insertError) {
          console.error(`ERRO NO INSERT (Lote ${i}):`, insertError);
          throw insertError;
        }
        insertedCount += chunk.length;
      }

      console.log("7. SUCESSO TOTAL!");
      alert(`Sucesso! ${insertedCount} vendas importadas.`);
      
      router.refresh(); 

    } catch (error) {
      console.error('--- ERRO FATAL ---', error);
      alert(`Erro no processo: ${error.message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  // Renderização Condicional das Abas
  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab summary={summaryData} topMaterials={topMaterials} />;
      
      case 'financial':
        return (
          <FinancialTab 
            summary={summaryData} 
            settings={settings}
            expenses={expenses}
            // Funções para atualizar o estado local instantaneamente ao salvar
            onSettingsChange={setSettings}
            onExpensesChange={setExpenses}
          />
        );
      
      case 'annual':
        // AQUI ESTÁ A CORREÇÃO: Passamos os cenários manuais para a aba Anual
        return (
          <AnnualTab 
            summary={summaryData} 
            settings={settings} 
            expenses={expenses} 
            scenarios={manualScenarios} 
          />
        );
      
      case 'sellers':
        return <SellersTab sellers={sellersData} />;
      
      default:
        return <OverviewTab summary={summaryData} topMaterials={topMaterials} />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar Desktop */}
      <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col shadow-sm z-10">
        <div className="p-6 border-b border-slate-100 flex items-center gap-2">
          <div className="bg-cyan-600 text-white p-1.5 rounded-lg font-bold shadow-sm">BI</div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 leading-tight">Marmoraria</h1>
            <p className="text-xs text-slate-500">Gestão Integrada</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <SidebarItem 
            icon={<LayoutDashboard size={20} />} 
            label="Visão Geral" 
            active={activeTab === 'overview'} 
            onClick={() => setActiveTab('overview')} 
          />
          <SidebarItem 
            icon={<DollarSign size={20} />} 
            label="Simulador Financeiro" 
            active={activeTab === 'financial'} 
            onClick={() => setActiveTab('financial')} 
          />
          <SidebarItem 
            icon={<FileText size={20} />} 
            label="Relatório Anual" 
            active={activeTab === 'annual'} 
            onClick={() => setActiveTab('annual')} 
          />
          <SidebarItem 
            icon={<Users size={20} />} 
            label="Vendedores" 
            active={activeTab === 'sellers'} 
            onClick={() => setActiveTab('sellers')} 
          />
        </nav>

        <div className="p-4 border-t border-slate-100 space-y-3">
          {/* Botão Upload */}
          <div className="relative">
            <input
              type="file"
              accept=".xlsx, .xls"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileUpload}
              disabled={isUploading}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className={`w-full flex items-center justify-center gap-2 p-3 rounded-lg text-sm font-bold transition-all shadow-sm
                ${isUploading 
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                  : 'bg-cyan-600 text-white hover:bg-cyan-700 hover:shadow-md'
                }`}
            >
              {isUploading ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
              {isUploading ? 'Processando...' : 'Carregar Planilha'}
            </button>
          </div>

          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 p-2 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors font-medium"
          >
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <main className="flex-1 overflow-y-auto custom-scroll">
        {/* Header Mobile */}
        <header className="bg-white border-b border-slate-200 p-4 flex justify-between items-center md:hidden sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <div className="bg-cyan-600 text-white p-1 rounded font-bold text-xs">BI</div>
            <h1 className="font-bold text-slate-800">Marmoraria</h1>
          </div>
          <button onClick={handleLogout} className="text-xs text-red-600 font-bold">Sair</button>
        </header>
        
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}

function SidebarItem({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm font-medium transition-all duration-200
        ${active 
          ? 'bg-cyan-50 text-cyan-700 border-r-4 border-cyan-600 font-bold' 
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
        }`}
    >
      <span className={active ? 'text-cyan-600' : 'text-slate-400'}>{icon}</span>
      {label}
    </button>
  );
}