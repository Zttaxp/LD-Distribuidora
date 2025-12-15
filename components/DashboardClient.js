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
  initialSellers 
}) {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  // Estados
  const [activeTab, setActiveTab] = useState('overview');
  const [isUploading, setIsUploading] = useState(false);
  
  // Dados vindos do Servidor
  const summaryData = initialSummary || [];
  const topMaterials = initialTopMaterials || [];
  const sellersData = initialSellers || [];

  const fileInputRef = useRef(null);

  // --- LÓGICA DE UPLOAD COM DEBUG DETALHADO ---
  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      console.log("--- INICIANDO UPLOAD DE DEBUG ---");
      console.log("1. Arquivo selecionado:", file.name, `(${file.size} bytes)`);

      // 1. Salvar arquivo no Storage
      const fileName = `${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(fileName, file);

      if (uploadError) {
        console.error("ERRO NO STORAGE:", uploadError);
        throw new Error(`Falha ao salvar arquivo no bucket: ${uploadError.message}`);
      }
      console.log("2. Upload no Storage concluído.");

      // 2. Criar registro do dataset
      const { data: datasetData, error: datasetError } = await supabase
        .from('datasets')
        .insert([{ name: file.name, uploaded_at: new Date() }])
        .select()
        .single();

      if (datasetError) {
        console.error("ERRO AO CRIAR DATASET:", datasetError);
        throw new Error(`Falha ao registrar dataset: ${datasetError.message}`);
      }
      console.log("3. Dataset registrado no banco. ID:", datasetData.id);

      // 3. Ler e Parsear Excel
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Converte para JSON bruto (array de arrays)
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      console.log(`4. Leitura do Excel concluída. Linhas encontradas: ${jsonData.length}`);

      if (jsonData.length < 2) {
        throw new Error("O arquivo Excel parece estar vazio ou tem apenas o cabeçalho.");
      }

      // Processa os dados usando o Parser corrigido
      const parsedSales = parseExcelData(jsonData, datasetData.id);
      console.log(`5. Parser concluído. Linhas válidas para inserção: ${parsedSales.length}`);

      if (parsedSales.length === 0) {
        console.warn("AVISO: O parser retornou 0 linhas. Verifique se as colunas da planilha batem com a lógica do parser.");
        throw new Error("Nenhuma venda válida foi encontrada na planilha. Verifique o formato.");
      }

      // 4. Inserir vendas em lotes (Chunks) para evitar timeout
      console.log("6. Iniciando inserção no banco de dados...");
      const chunkSize = 1000;
      let insertedCount = 0;

      for (let i = 0; i < parsedSales.length; i += chunkSize) {
        const chunk = parsedSales.slice(i, i + chunkSize);
        const { error: insertError } = await supabase.from('sales').insert(chunk);
        
        if (insertError) {
          console.error(`ERRO NO INSERT (Lote ${i}):`, insertError);
          // Se for erro de RLS, vai aparecer aqui explicitamente
          if (insertError.code === '42501') {
            throw new Error("Erro de Permissão (RLS): Seu usuário não tem permissão para inserir vendas.");
          }
          throw insertError;
        }
        insertedCount += chunk.length;
        console.log(`   - Lote inserido: ${insertedCount} / ${parsedSales.length}`);
      }

      console.log("7. SUCESSO TOTAL! Todas as linhas inseridas.");
      alert(`Sucesso! ${insertedCount} vendas foram importadas.`);
      
      // Atualiza a página para mostrar os dados novos
      router.refresh(); 

    } catch (error) {
      console.error('--- ERRO FATAL NO PROCESSO ---', error);
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
        return <FinancialTab summary={summaryData} />;
      case 'annual':
        return <AnnualTab summary={summaryData} />;
      case 'sellers':
        return <SellersTab sellers={sellersData} />;
      default:
        return <OverviewTab summary={summaryData} topMaterials={topMaterials} />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar Desktop */}
      <aside className="w-64 bg-white border-r border-gray-200 hidden md:flex flex-col">
        <div className="p-6 border-b border-gray-100">
          <h1 className="text-xl font-bold text-gray-800">Marmoraria BI</h1>
          <p className="text-xs text-gray-500 mt-1">Gestão Inteligente</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <SidebarItem 
            icon={<LayoutDashboard size={20} />} 
            label="Visão Geral" 
            active={activeTab === 'overview'} 
            onClick={() => setActiveTab('overview')} 
          />
          <SidebarItem 
            icon={<DollarSign size={20} />} 
            label="Financeiro (DRE)" 
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

        <div className="p-4 border-t border-gray-100 space-y-2">
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
              className={`w-full flex items-center justify-center gap-2 p-3 rounded-lg text-sm font-medium transition-colors
                ${isUploading 
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                  : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
            >
              {isUploading ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
              {isUploading ? 'Processando...' : 'Importar Excel'}
            </button>
          </div>

          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 p-3 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut size={18} />
            Sair
          </button>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <main className="flex-1 overflow-y-auto">
        {/* Header Mobile */}
        <header className="bg-white border-b border-gray-200 p-6 flex justify-between items-center md:hidden">
          <h1 className="font-bold text-gray-800">Marmoraria BI</h1>
          <button onClick={handleLogout} className="text-sm text-red-600">Sair</button>
        </header>
        
        <div className="p-6 md:p-10 max-w-7xl mx-auto">
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
      className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm font-medium transition-all
        ${active 
          ? 'bg-blue-50 text-blue-700 shadow-sm' 
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
        }`}
    >
      {icon}
      {label}
    </button>
  );
}