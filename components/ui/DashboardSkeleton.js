export default function DashboardSkeleton() {
  return (
    <div className="w-full p-6 space-y-8 animate-pulse">
      {/* Cabeçalho */}
      <div className="flex justify-between items-center mb-8">
        <div className="h-8 bg-gray-200 rounded w-1/3"></div>
        <div className="h-10 bg-gray-200 rounded w-32"></div>
      </div>

      {/* Cards de KPI (4 colunas) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>
        ))}
      </div>

      {/* Gráfico Principal */}
      <div className="h-96 bg-gray-200 rounded-xl mt-8"></div>

      {/* Tabelas/Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
        <div className="h-64 bg-gray-200 rounded-xl"></div>
        <div className="h-64 bg-gray-200 rounded-xl"></div>
      </div>
    </div>
  )
}