import { createClient } from '@/utils/supabase/server';
import DashboardClient from '@/components/DashboardClient';
import DashboardSkeleton from '@/components/ui/DashboardSkeleton';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

async function loadDashboardData() {
  const supabase = await createClient();

  const [
    summaryResult, 
    materialsResult, 
    sellersResult, 
    settingsResult, 
    expensesResult,
    scenariosResult // <--- NOVO: Buscando cenários manuais
  ] = await Promise.all([
    supabase.from('monthly_sales_summary').select('*'),
    supabase.from('top_materials_summary').select('*'),
    supabase.from('sellers_summary').select('*'),
    supabase.from('app_settings').select('*').single(),
    supabase.from('expenses').select('*'),
    supabase.from('manual_scenarios').select('*') // <--- NOVO
  ]);

  return {
    salesSummary: summaryResult.data || [],
    topMaterials: materialsResult.data || [],
    sellersSummary: sellersResult.data || [],
    appSettings: settingsResult.data || { tax_rate: 6, comm_rate: 3, bad_debt_rate: 0 },
    expenses: expensesResult.data || [],
    manualScenarios: scenariosResult.data || [] // <--- NOVO
  };
}

export default async function Page() {
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
          initialScenarios={data.manualScenarios} // <--- Passando para o cliente
        />
      </Suspense>
    </main>
  );
}