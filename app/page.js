import { createClient } from '@/utils/supabase/server';
import DashboardClient from '@/components/DashboardClient';
import DashboardSkeleton from '@/components/ui/DashboardSkeleton';
import { Suspense } from 'react';
import { redirect } from 'next/navigation'; // <--- IMPORTANTE: Adicionar isso

export const dynamic = 'force-dynamic';

async function loadDashboardData() {
  const supabase = await createClient();

  const [
    summaryResult, 
    materialsResult, 
    sellersResult, 
    settingsResult, 
    expensesResult,
    scenariosResult 
  ] = await Promise.all([
    supabase.from('monthly_sales_summary').select('*'),
    supabase.from('top_materials_summary').select('*'),
    supabase.from('sellers_summary').select('*'),
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

export default async function Page() {
  // 1. Cria o cliente para verificar autenticação
  const supabase = await createClient();

  // 2. Verifica se o usuário está logado
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    redirect('/login');
  }

  // 3. Busca o PERFIL (Role e Nome) - A Lógica Nova
  let userProfile = { role: 'vendedor', name: '' };
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profile) {
    userProfile = profile;
  }

  // 4. Carrega os dados (Sua lógica original)
  const data = await loadDashboardData();

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
          // 5. Passamos o perfil para o cliente decidir o que mostrar
          userProfile={userProfile} 
        />
      </Suspense>
    </main>
  );
}