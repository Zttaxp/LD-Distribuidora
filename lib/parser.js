import * as XLSX from 'xlsx';

// Helper para encontrar a coluna correta (Case Insensitive e variações)
const getKey = (row, candidates) => {
  const rowKeys = Object.keys(row);
  for (const candidate of candidates) {
    const exact = rowKeys.find(k => k.trim().toLowerCase() === candidate.toLowerCase());
    if (exact) return exact;
  }
  for (const candidate of candidates) {
    const match = rowKeys.find(k => {
      const cleanKey = k.trim().toLowerCase();
      // Evita falsos positivos (ex: não confundir 'id' com 'venda_id')
      if ((cleanKey.includes('cod') || cleanKey.includes('id')) && !candidate.toLowerCase().includes('cod')) return false;
      return cleanKey.includes(candidate.toLowerCase());
    });
    if (match) return match;
  }
  return null;
};

// Helper de limpeza numérica (Trata 1.000,00 e 1,000.00)
const cleanNum = (val) => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  
  const str = String(val).trim();
  if (!str) return 0;

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
           // Assume DD/MM/YYYY
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
    // 1. IDENTIFICAÇÃO DAS COLUNAS
    const keyDate = getKey(row, ['DataVenda', 'Data', 'Dt. Venda']);
    const keySeller = getKey(row, ['Vendedor', 'VendedorNome']);
    const keyClient = getKey(row, ['Cliente', 'ClienteNome']);
    const keyMaterial = getKey(row, ['Material', 'Produto', 'Descricao']);
    const keyChapa = getKey(row, ['NroChapa', 'Chapa']);
    
    // Colunas de Valores
    const keyPrecoUnit = getKey(row, ['PrecoUnit', 'Valor', 'Vlr. Unit', 'ValorTotalDocumento']); 
    const keyPrecoTotalBruto = getKey(row, ['PrecoTotalBruto', 'ValorTotal', 'Vlr. Bruto']); 
    
    const keyCost = getKey(row, ['CustoTotalM2', 'Custo']);
    const keyM2 = getKey(row, ['Total_M2_Venda', 'Qtd', 'M2']);

    // Se faltar data ou valor, pula a linha
    if (!keyDate || !keyPrecoUnit) return null;

    const dateObj = parseDate(row[keyDate]);
    if (!dateObj) return null;

    // Normalização de Strings
    const seller = row[keySeller] ? String(row[keySeller]).trim().toUpperCase() : 'DESCONHECIDO';
    const client = row[keyClient] ? String(row[keyClient]).trim() : 'Consumidor';
    
    let material = row[keyMaterial] ? String(row[keyMaterial]).trim() : 'MATERIAL INDEFINIDO';
    material = material.replace(/^CHAPA (DE )?/i, '').trim();
    if (material === '') material = 'OUTROS';

    const chapa = row[keyChapa] ? String(row[keyChapa]).trim() : '-';

    // 2. REGRA DE NEGÓCIO (Frete vs Desconto)
    const valPrecoUnit = cleanNum(row[keyPrecoUnit]);
    const valPrecoTotalBruto = keyPrecoTotalBruto ? cleanNum(row[keyPrecoTotalBruto]) : valPrecoUnit;

    let finalRevenue = 0;
    let finalFreight = 0;

    if (valPrecoUnit < valPrecoTotalBruto) {
        // Tem Frete (Valor Bruto > Unitário)
        finalRevenue = valPrecoUnit;
        finalFreight = valPrecoTotalBruto - valPrecoUnit;
    } else {
        // Desconto ou Igual
        finalRevenue = valPrecoTotalBruto;
        finalFreight = 0;
    }

    const cost = cleanNum(row[keyCost]);
    const m2_total = cleanNum(row[keyM2]);

    // 3. RETORNO PARA O SUPABASE
    // (Removi campos calculados como year/month/type para evitar erro de coluna inexistente no banco)
    return {
      dataset_id: datasetId, // <--- CAMPO OBRIGATÓRIO
      date: dateObj.toISOString(),
      seller: seller,
      client: client,
      material: material,
      chapa: chapa,
      revenue: finalRevenue,
      cost: cost,
      freight: finalFreight,
      m2_total: m2_total
    };
  }).filter(item => item !== null);
}