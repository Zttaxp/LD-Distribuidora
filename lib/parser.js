import * as XLSX from 'xlsx';

const getKey = (row, candidates) => {
  const rowKeys = Object.keys(row);
  for (const candidate of candidates) {
    const exact = rowKeys.find(k => k.trim().toLowerCase() === candidate.toLowerCase());
    if (exact) return exact;
  }
  for (const candidate of candidates) {
    const match = rowKeys.find(k => {
      const cleanKey = k.trim().toLowerCase();
      if ((cleanKey.includes('cod') || cleanKey.includes('id')) && !candidate.toLowerCase().includes('cod')) return false;
      return cleanKey.includes(candidate.toLowerCase());
    });
    if (match) return match;
  }
  return null;
};

const cleanNum = (val) => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const cleanString = String(val).replace(/[^\d.,-]/g, ''); 
  const float = parseFloat(cleanString.replace(',', '.'));
  return isNaN(float) ? 0 : float;
};

// Helper corrigido para lidar com datas do Excel
const parseDate = (val) => {
  let date;
  if (val instanceof Date) {
    date = val;
  } else if (typeof val === 'number') {
    date = new Date(Math.round((val - 25569) * 86400 * 1000));
  } else if (typeof val === 'string') {
    // Tenta converter strings PT-BR (DD/MM/AAAA)
    if (val.includes('/')) {
        const [d, m, y] = val.split('/');
        date = new Date(`${y}-${m}-${d}`);
    } else {
        date = new Date(val);
    }
  } else {
    date = new Date();
  }
  
  // Garante que a data é válida
  if (isNaN(date.getTime())) date = new Date();
  return date;
};

export function parseExcelData(jsonData, datasetId) {
  return jsonData.map(row => {
    const keyDate = getKey(row, ['DataVenda', 'Data', 'Criacao', 'Dt. Venda']);
    const keySeller = getKey(row, ['Vendedor', 'VendedorNome', 'Repres.']);
    const keyClient = getKey(row, ['Cliente', 'ClienteNome', 'Sacado']);
    const keyMaterial = getKey(row, ['Material', 'Produto', 'Descricao', 'Item']);
    const keyChapa = getKey(row, ['NroChapa', 'Chapa', 'NumChapa']);
    const keyRev = getKey(row, ['PrecoUnit', 'ValorTotalDocumento', 'Valor', 'Vlr. Total']);
    const keyGross = getKey(row, ['PrecoTotalBruto', 'ValorTotal', 'Vlr. Bruto']); 
    const keyCost = getKey(row, ['CustoTotalM2', 'Custo', 'CustoTotal']);
    const keyM2 = getKey(row, ['Total_M2_Venda', 'Qtd', 'M2', 'Metragem']);

    if (!keyDate || !keyRev) return null;

    // Data e Campos Auxiliares (CORREÇÃO AQUI)
    const dateObj = parseDate(row[keyDate]);
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth() + 1; // 1-12
    const month_key = `${year}-${month}`;

    const seller = row[keySeller] ? String(row[keySeller]).trim().toUpperCase() : 'DESCONHECIDO';
    const client = row[keyClient] ? String(row[keyClient]).trim() : 'Consumidor';
    
    let material = row[keyMaterial] ? String(row[keyMaterial]).trim() : 'MATERIAL INDEFINIDO';
    material = material.replace(/^CHAPA (DE )?/i, '').trim();
    if (material === '') material = 'OUTROS';

    const chapa = row[keyChapa] ? String(row[keyChapa]).trim() : '-';

    const revenue = cleanNum(row[keyRev]);
    const grossTotal = row[keyGross] ? cleanNum(row[keyGross]) : revenue;
    const cost = cleanNum(row[keyCost]);
    const m2_total = cleanNum(row[keyM2]);

    const freight = Math.max(0, grossTotal - revenue);
    const price_per_m2 = m2_total > 0 ? revenue / m2_total : 0;
    const type = price_per_m2 > 300 ? 'HIGH' : 'LOW';

    return {
      dataset_id: datasetId,
      date: dateObj.toISOString(),
      year,        // Adicionado
      month,       // Adicionado
      month_key,   // Adicionado
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
  }).filter(item => item !== null);
}