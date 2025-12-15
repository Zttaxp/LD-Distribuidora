import { createClient } from '@/utils/supabase/server';
import DashboardClient from '@/components/DashboardClient';
import DashboardSkeleton from '@/components/ui/DashboardSkeleton';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

// Função auxiliar para buscar dados em paralelo
async function loadDashboardData() {
  const supabase = createClient();

  // Promise.all executa as 3 consultas ao mesmo tempo (muito mais rápido)
  const [summaryResult, materialsResult, sellersResult] = await Promise.all([
    supabase.from('monthly_sales_summary').select('*'),
    supabase.from('top_materials_summary').select('*').limit(10),
    supabase.from('sellers_summary').select('*')
  ]);

  return {
    salesSummary: summaryResult.data || [],
    topMaterials: materialsResult.data || [],
    sellersSummary: sellersResult.data || []
  };
}

export default async function Page() {
  // O servidor aguarda os dados aqui
  const data = await loadDashboardData();

  return (
    <main className="min-h-screen bg-gray-50">
      {/* O Skeleton aparece enquanto loadDashboardData roda */}
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardClient 
          initialSummary={data.salesSummary}
          initialTopMaterials={data.topMaterials}
          initialSellers={data.sellersSummary}
        />
      </Suspense>
    </main>
  );
}