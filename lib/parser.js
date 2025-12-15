import * as XLSX from 'xlsx';

// Helper igual ao do seu HTML para achar colunas por nome aproximado
const getKey = (row, candidates) => {
  const rowKeys = Object.keys(row);
  // 1. Tenta match exato
  for (const candidate of candidates) {
    const exact = rowKeys.find(k => k.trim().toLowerCase() === candidate.toLowerCase());
    if (exact) return exact;
  }
  // 2. Tenta match parcial (ex: "Nome do Vendedor" bate com "Vendedor")
  for (const candidate of candidates) {
    const match = rowKeys.find(k => {
      const cleanKey = k.trim().toLowerCase();
      // Evita falsos positivos (ex: não pegar 'CodVendedor' se busca 'Vendedor')
      if ((cleanKey.includes('cod') || cleanKey.includes('id')) && !candidate.toLowerCase().includes('cod')) return false;
      return cleanKey.includes(candidate.toLowerCase());
    });
    if (match) return match;
  }
  return null;
};

// Helper para limpar números (R$ 1.200,50 -> 1200.50)
const cleanNum = (val) => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  // Remove tudo que não é número, vírgula ou ponto e traço
  const cleanString = String(val).replace(/[^\d.,-]/g, ''); 
  // Troca vírgula por ponto para JS entender
  const float = parseFloat(cleanString.replace(',', '.'));
  return isNaN(float) ? 0 : float;
};

// Helper de data
const parseDate = (val) => {
  if (val instanceof Date) return val.toISOString();
  if (!val) return new Date().toISOString();
  if (typeof val === 'number') {
    // Data serial do Excel
    return new Date(Math.round((val - 25569) * 86400 * 1000)).toISOString();
  }
  return new Date(val).toISOString(); // Tenta string normal
};

export function parseExcelData(jsonData, datasetId) {
  // O sheet_to_json já devolve objetos, não arrays. Não precisamos pular cabeçalho.
  
  return jsonData.map(row => {
    // LÓGICA IDÊNTICA AO HTML (preProcessData)
    const keyDate = getKey(row, ['DataVenda', 'Data', 'Criacao', 'Dt. Venda']);
    const keySeller = getKey(row, ['Vendedor', 'VendedorNome', 'Repres.']);
    const keyClient = getKey(row, ['Cliente', 'ClienteNome', 'Sacado']);
    const keyMaterial = getKey(row, ['Material', 'Produto', 'Descricao', 'Item']);
    const keyChapa = getKey(row, ['NroChapa', 'Chapa', 'NumChapa']);
    const keyRev = getKey(row, ['PrecoUnit', 'ValorTotalDocumento', 'Valor', 'Vlr. Total']);
    const keyGross = getKey(row, ['PrecoTotalBruto', 'ValorTotal', 'Vlr. Bruto']); 
    const keyCost = getKey(row, ['CustoTotalM2', 'Custo', 'CustoTotal']);
    const keyM2 = getKey(row, ['Total_M2_Venda', 'Qtd', 'M2', 'Metragem']);

    // Se não tiver data ou valor, ignora (igual ao HTML)
    if (!keyDate || !keyRev) return null;

    const rawDate = row[keyDate];
    const seller = row[keySeller] ? String(row[keySeller]).trim().toUpperCase() : 'DESCONHECIDO';
    const client = row[keyClient] ? String(row[keyClient]).trim() : 'Consumidor';
    
    // Limpeza de Material igual ao HTML
    let material = row[keyMaterial] ? String(row[keyMaterial]).trim() : 'MATERIAL INDEFINIDO';
    material = material.replace(/^CHAPA (DE )?/i, '').trim();
    if (material === '') material = 'OUTROS';

    const chapa = row[keyChapa] ? String(row[keyChapa]).trim() : '-';

    // Valores Numéricos
    const revenue = cleanNum(row[keyRev]); // Valor Líquido
    const grossTotal = row[keyGross] ? cleanNum(row[keyGross]) : revenue; // Se não tiver bruto, assume líquido
    const cost = cleanNum(row[keyCost]);
    const m2_total = cleanNum(row[keyM2]);

    // Cálculos de Negócio (Iguais ao HTML)
    const freight = Math.max(0, grossTotal - revenue); // Frete é a diferença
    const price_per_m2 = m2_total > 0 ? revenue / m2_total : 0;
    const type = price_per_m2 > 300 ? 'HIGH' : 'LOW'; // Regra de classificação

    return {
      dataset_id: datasetId,
      date: parseDate(rawDate),
      seller,
      client,
      material,
      chapa,
      revenue,
      cost,
      freight,
      m2_total,
      price_per_m2,
      type
    };
  }).filter(item => item !== null); // Remove linhas inválidas
}