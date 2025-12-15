// lib/parser.js

// Helper para limpar valores monetários (ex: "1.200,50" -> 1200.50)
const parseBRL = (value) => {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  // Remove R$, espaços, pontos de milhar e troca vírgula por ponto
  const cleanString = value.toString().replace(/[R$\s.]/g, '').replace(',', '.');
  const float = parseFloat(cleanString);
  return isNaN(float) ? 0 : float;
};

// Helper para converter datas do Excel (número serial ou string)
const parseDate = (value) => {
  if (!value) return new Date().toISOString();
  
  // Se for número serial do Excel (ex: 45321)
  if (typeof value === 'number') {
    // Ajuste de data base do Excel (1900)
    const date = new Date(Math.round((value - 25569) * 86400 * 1000));
    return date.toISOString();
  }
  
  // Se for string "DD/MM/YYYY"
  if (typeof value === 'string' && value.includes('/')) {
    const [day, month, year] = value.split('/');
    // Cria data segura ISO (YYYY-MM-DD)
    return new Date(`${year}-${month}-${day}`).toISOString();
  }

  return new Date().toISOString();
};

// --- FUNÇÃO PRINCIPAL ---
// Atenção: O nome deve ser exatamente parseExcelData para bater com o DashboardClient
export function parseExcelData(rows, datasetId) {
  // Pula o cabeçalho (primeira linha) se necessário, ou assume que rows já são os dados
  // O sheet_to_json(header:1) do XLSX gera array de arrays. A linha 0 é cabeçalho.
  const dataRows = rows.slice(1); 

  return dataRows.map((row) => {
    // Mapeamento das colunas pelo índice (A=0, B=1, C=2...)
    // Ajuste esses índices conforme a SUA planilha real
    const rawDate = row[0];      // Coluna A: Data
    const seller = row[1];       // Coluna B: Vendedor
    const client = row[2];       // Coluna C: Cliente
    const material = row[3];     // Coluna D: Material
    const chapa = row[4];        // Coluna E: Chapa
    const valorBruto = parseBRL(row[5]); // Coluna F: Valor Bruto
    const revenue = parseBRL(row[6]);    // Coluna G: Valor Líquido (Receita)
    const cost = parseBRL(row[7]);       // Coluna H: CMV (Custo)
    const m2_total = parseBRL(row[8]);   // Coluna I: M2 Total

    // Cálculos de Negócio
    const freight = Math.max(0, valorBruto - revenue); // Frete é a diferença (se houver)
    const price_per_m2 = m2_total > 0 ? revenue / m2_total : 0;
    const type = price_per_m2 > 300 ? 'HIGH' : 'LOW'; // Regra de classificação

    return {
      dataset_id: datasetId,
      date: parseDate(rawDate),
      seller: seller ? String(seller).trim() : 'N/A',
      client: client ? String(client).trim() : 'Consumidor',
      material: material ? String(material).toUpperCase().trim() : 'OUTROS',
      chapa: chapa ? String(chapa) : '',
      revenue,     // Valor que entra no caixa
      cost,        // Custo do material
      freight,     // Frete calculado
      m2_total,
      price_per_m2,
      type
    };
  }).filter(item => item.revenue > 0 || item.cost > 0); // Remove linhas vazias
}