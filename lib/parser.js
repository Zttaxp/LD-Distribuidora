import * as XLSX from 'xlsx';

// Helper para encontrar a coluna correta
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

// Helper de limpeza numérica
const cleanNum = (val) => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  
  const str = String(val).trim();
  if (!str) return 0;

  // Detecção de formato BR (1.000,00) vs US (1,000.00)
  if (str.includes(',') && !str.includes('.')) {
     return parseFloat(str.replace(/\./g, '').replace(',', '.'));
  }
  if (str.includes('.') && str.includes(',')) {
     const lastDot = str.lastIndexOf('.');
     const lastComma = str.lastIndexOf(',');
     if (lastComma > lastDot) {
        return parseFloat(str.replace(/\./g, '').replace(',', '.')); // BR
     } else {
        return parseFloat(str.replace(/,/g, '')); // US
     }
  }
  
  const cleanString = str.replace(/[^\d.,-]/g, '');
  let float = parseFloat(cleanString.replace(',', '.')); 
  return isNaN(float) ? 0 : float;
};

const parseDate = (val) => {
  if (!val) return null;
  let date;
  if (val instanceof Date) {
    date = val;
  } else if (typeof val === 'number') {
    date = new Date(Math.round((val - 25569) * 86400 * 1000));
  } else if (typeof val === 'string') {
    if (val.includes('/')) {
        const parts = val.split('/');
        if (parts.length === 3) {
           date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        }
    } else {
        date = new Date(val);
    }
  }
  if (!date || isNaN(date.getTime())) return null;
  return date;
};

export function parseExcelData(jsonData, datasetId) {
  return jsonData.map(row => {
    // MAPEAMENTO DAS COLUNAS (PRIORIZANDO OS NOMES QUE VOCÊ DEU)
    const keyDate = getKey(row, ['DataVenda', 'Data', 'Dt. Venda']);
    const keySeller = getKey(row, ['Vendedor', 'VendedorNome']);
    const keyClient = getKey(row, ['Cliente', 'ClienteNome']);
    const keyMaterial = getKey(row, ['Material', 'Produto', 'Descricao']);
    const keyChapa = getKey(row, ['NroChapa', 'Chapa']);
    
    // Suas Colunas Específicas
    const keyPrecoUnit = getKey(row, ['PrecoUnit', 'Valor', 'Vlr. Unit', 'ValorTotalDocumento']); 
    const keyPrecoTotalBruto = getKey(row, ['PrecoTotalBruto', 'ValorTotal', 'Vlr. Bruto']); 
    
    const keyCost = getKey(row, ['CustoTotalM2', 'Custo']);
    const keyM2 = getKey(row, ['Total_M2_Venda', 'Qtd', 'M2']);

    // Se faltar data ou o valor unitário base, ignora
    if (!keyDate || !keyPrecoUnit) return null;

    const dateObj = parseDate(row[keyDate]);
    if (!dateObj) return null;

    const year = dateObj.getFullYear();
    const month = dateObj.getMonth() + 1;
    const month_key = `${year}-${month}`;

    const seller = row[keySeller] ? String(row[keySeller]).trim().toUpperCase() : 'DESCONHECIDO';
    const client = row[keyClient] ? String(row[keyClient]).trim() : 'Consumidor';
    
    let material = row[keyMaterial] ? String(row[keyMaterial]).trim() : 'MATERIAL INDEFINIDO';
    material = material.replace(/^CHAPA (DE )?/i, '').trim();
    if (material === '') material = 'OUTROS';

    const chapa = row[keyChapa] ? String(row[keyChapa]).trim() : '-';

    // --- APLICAÇÃO DA REGRA DE NEGÓCIO ---
    const valPrecoUnit = cleanNum(row[keyPrecoUnit]);
    const valPrecoTotalBruto = keyPrecoTotalBruto ? cleanNum(row[keyPrecoTotalBruto]) : valPrecoUnit;

    let finalRevenue = 0;
    let finalFreight = 0;

    if (valPrecoUnit < valPrecoTotalBruto) {
        // CASO 1: TEM FRETE
        // Faturamento é o PrecoUnit
        // Frete é a diferença
        finalRevenue = valPrecoUnit;
        finalFreight = valPrecoTotalBruto - valPrecoUnit;
    } else {
        // CASO 2: DESCONTO (Unit > Bruto) OU IGUAL
        // Adota o PrecoTotalBruto como faturamento real (com desconto)
        // Frete é zero
        finalRevenue = valPrecoTotalBruto;
        finalFreight = 0;
    }

    const cost = cleanNum(row[keyCost]);
    const m2_total = cleanNum(row[keyM2]);
    const price_per_m2 = m2_total > 0 ? finalRevenue / m2_total : 0;
    const type = price_per_m2 > 300 ? 'HIGH' : 'LOW';

    return {
      dataset_id: datasetId,
      date: dateObj.toISOString(),
      year,
      month,
      month_key,
      seller,
      client,
      material,
      chapa,
      revenue: finalRevenue, // Valor calculado pela regra
      cost,
      freight: finalFreight, // Valor calculado pela regra
      m2_total,
      price_per_m2,
      type
    };
  }).filter(item => item !== null);
}