import { createClient } from '@/utils/supabase/server';
import DashboardClient from '@/components/DashboardClient';
import DashboardSkeleton from '@/components/ui/DashboardSkeleton';
import { Suspense } from 'react';

// Força a página a ser dinâmica (sem cache)
export const dynamic = 'force-dynamic';

async function loadDashboardData() {
  // Agora usamos await aqui, pois a função virou assíncrona
  const supabase = await createClient();

  console.log("--- BUSCANDO DADOS NO SERVER ---");

  const [summaryResult, materialsResult, sellersResult] = await Promise.all([
    supabase.from('monthly_sales_summary').select('*'),
    supabase.from('top_materials_summary').select('*').limit(10),
    supabase.from('sellers_summary').select('*')
  ]);

  // Debug: Se estiver vazio, vai aparecer nos Logs da Vercel
  console.log("Resumo encontrado:", summaryResult.data?.length || 0);
  console.log("Erro (se houver):", summaryResult.error);

  return {
    salesSummary: summaryResult.data || [],
    topMaterials: materialsResult.data || [],
    sellersSummary: sellersResult.data || []
  };
}

export default async function Page() {
  const data = await loadDashboardData();

  return (
    <main className="min-h-screen bg-gray-50">
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