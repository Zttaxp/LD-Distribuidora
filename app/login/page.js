import { createClient } from '@/utils/supabase/server';
import DashboardClient from '@/components/DashboardClient';
import DashboardSkeleton from '@/components/ui/DashboardSkeleton';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

async function loadDashboardData(datasetId) {
  const supabase = await createClient();

  // Se não houver ID válido, retorna objetos vazios sem chamar o banco
  if (!datasetId || datasetId === 'undefined' || datasetId === 'null') {
    return {
      salesSummary: [], topMaterials: [], sellersSummary: [], 
      appSettings: {}, expenses: [], manualScenarios: []
    };
  }

  const [
    summaryResult, 
    materialsResult, 
    sellersResult, 
    settingsResult, 
    expensesResult,
    scenariosResult 
  ] = await Promise.all([
    supabase.from('monthly_sales_summary').select('*').eq('dataset_id', datasetId),
    supabase.from('top_materials_summary').select('*').eq('dataset_id', datasetId),
    supabase.from('sellers_summary').select('*').eq('dataset_id', datasetId),
    supabase.from('app_settings').select('*').single(),
    supabase.from('expenses').select('*'),
    supabase.from('manual_scenarios').select('*') 
  ]);

  return {
    salesSummary: summaryResult.data || [],
    topMaterials: materialsResult.data || [],
    sellersSummary: sellersResult.data || [],
    appSettings: settingsResult.data || { tax_rate: 6, comm_rate: 3, bad_debt_rate: 0 },
    expenses: expensesResult.data || [],
    manualScenarios: scenariosResult.data || [] 
  };
}

export default async function Page({ searchParams }) {
  const supabase = await createClient();

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect('/login');

  let userProfile = { role: 'vendedor', name: '' };
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (profile) userProfile = profile;

  // Busca lista de Datasets
  const { data: datasets } = await supabase
    .from('datasets')
    .select('*')
    .order('uploaded_at', { ascending: false });

  // Pega o ID da URL ou o primeiro da lista
  const currentDatasetId = searchParams?.datasetId || datasets?.[0]?.id;

  const data = await loadDashboardData(currentDatasetId);

  return (
    <main className="min-h-screen bg-slate-50">
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardClient 
          initialSummary={data.salesSummary}
          initialTopMaterials={data.topMaterials}
          initialSellers={data.sellersSummary}
          initialSettings={data.appSettings}
          initialExpenses={data.expenses}
          initialScenarios={data.manualScenarios}
          userProfile={userProfile}
          datasets={datasets || []}
          currentDatasetId={currentDatasetId}
        />
      </Suspense>
    </main>
  );
}