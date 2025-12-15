import { createClient } from '@/utils/supabase/server';
import DashboardClient from '@/components/DashboardClient';
import DashboardSkeleton from '@/components/ui/DashboardSkeleton';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

async function loadDashboardData() {
  const supabase = await createClient();

  // Buscamos tudo em paralelo para ser rápido
  const [summaryResult, materialsResult, sellersResult, settingsResult, expensesResult] = await Promise.all([
    supabase.from('monthly_sales_summary').select('*'),
    supabase.from('top_materials_summary').select('*'), // Removi o limit para permitir filtragem no front se precisar
    supabase.from('sellers_summary').select('*'),
    supabase.from('app_settings').select('*').single(), // Pega a configuração única
    supabase.from('expenses').select('*') // Pega todas as despesas
  ]);

  return {
    salesSummary: summaryResult.data || [],
    topMaterials: materialsResult.data || [],
    sellersSummary: sellersResult.data || [],
    appSettings: settingsResult.data || { tax_rate: 6, comm_rate: 3, bad_debt_rate: 0 },
    expenses: expensesResult.data || []
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
        />
      </Suspense>
    </main>
  );
}