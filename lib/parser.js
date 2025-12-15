import * as XLSX from 'xlsx';

// Helper para encontrar a coluna correta (Case insensitive e parcial)
const getKey = (row, candidates) => {
  const rowKeys = Object.keys(row);
  // 1. Busca Exata
  for (const candidate of candidates) {
    const exact = rowKeys.find(k => k.trim().toLowerCase() === candidate.toLowerCase());
    if (exact) return exact;
  }
  // 2. Busca Parcial (ex: "Valor Total" contém "Valor")
  for (const candidate of candidates) {
    const match = rowKeys.find(k => {
      const cleanKey = k.trim().toLowerCase();
      // Proteção para não confundir ID/Código com valores
      if ((cleanKey.includes('cod') || cleanKey.includes('id')) && !candidate.toLowerCase().includes('cod')) return false;
      return cleanKey.includes(candidate.toLowerCase());
    });
    if (match) return match;
  }
  return null;
};

// Helper de limpeza numérica BR (Remove ponto de milhar, troca vírgula por ponto)
const cleanNum = (val) => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  
  const str = String(val).trim();
  if (!str) return 0;

  // Se tiver formato BR "1.200,50", remove ponto e troca vírgula
  // Se for formato US "1,200.50", remove vírgula
  
  // Detecção simples: se tem vírgula no final, é decimal BR
  if (str.includes(',') && !str.includes('.')) {
     // Ex: 1200,50
     return parseFloat(str.replace(/\./g, '').replace(',', '.'));
  }
  if (str.includes('.') && str.includes(',')) {
     // Misto. Assume que o último separador é o decimal.
     const lastDot = str.lastIndexOf('.');
     const lastComma = str.lastIndexOf(',');
     if (lastComma > lastDot) {
        // BR: 1.200,50
        return parseFloat(str.replace(/\./g, '').replace(',', '.'));
     } else {
        // US: 1,200.50
        return parseFloat(str.replace(/,/g, ''));
     }
  }
  
  // Padrão genérico de limpeza
  const cleanString = str.replace(/[^\d.,-]/g, '');
  // Tenta parse direto
  let float = parseFloat(cleanString.replace(',', '.')); 
  return isNaN(float) ? 0 : float;
};

const parseDate = (val) => {
  if (!val) return null; // Retorna null se vazio
  
  let date;
  if (val instanceof Date) {
    date = val;
  } else if (typeof val === 'number') {
    // Data serial Excel
    date = new Date(Math.round((val - 25569) * 86400 * 1000));
  } else if (typeof val === 'string') {
    // Tenta DD/MM/AAAA
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
  
  // Validação rigorosa: Se inválida, retorna null (para ser descartada)
  if (!date || isNaN(date.getTime())) return null;
  
  return date;
};

export function parseExcelData(jsonData, datasetId) {
  return jsonData.map(row => {
    // LISTAS DE CHAVES IDÊNTICAS AO HTML
    const keyDate = getKey(row, ['DataVenda', 'Data', 'Criacao', 'Dt. Venda']);
    const keySeller = getKey(row, ['Vendedor', 'VendedorNome', 'Repres.']);
    const keyClient = getKey(row, ['Cliente', 'ClienteNome', 'Sacado']);
    const keyMaterial = getKey(row, ['Material', 'Produto', 'Descricao', 'Item']);
    const keyChapa = getKey(row, ['NroChapa', 'Chapa', 'NumChapa']);
    
    // ATENÇÃO: Revenue (Líquido) vs Gross (Bruto)
    // HTML prioritiza 'ValorTotalDocumento' ou 'Valor' para Líquido
    const keyRev = getKey(row, ['PrecoUnit', 'ValorTotalDocumento', 'Valor', 'Vlr. Liq']); 
    
    // HTML prioritiza 'PrecoTotalBruto' ou 'ValorTotal' para Bruto
    const keyGross = getKey(row, ['PrecoTotalBruto', 'ValorTotal', 'Vlr. Bruto']); 
    
    const keyCost = getKey(row, ['CustoTotalM2', 'Custo', 'CustoTotal']);
    const keyM2 = getKey(row, ['Total_M2_Venda', 'Qtd', 'M2', 'Metragem']);

    // Se não achou data ou valor, ignora a linha (Igual HTML)
    if (!keyDate || !keyRev) return null;

    // Processa Data Rigorosamente
    const dateObj = parseDate(row[keyDate]);
    if (!dateObj) return null; // DESCARTA LINHAS DE LIXO/TOTAIS

    const year = dateObj.getFullYear();
    const month = dateObj.getMonth() + 1;
    const month_key = `${year}-${month}`;

    const seller = row[keySeller] ? String(row[keySeller]).trim().toUpperCase() : 'DESCONHECIDO';
    const client = row[keyClient] ? String(row[keyClient]).trim() : 'Consumidor';
    
    let material = row[keyMaterial] ? String(row[keyMaterial]).trim() : 'MATERIAL INDEFINIDO';
    material = material.replace(/^CHAPA (DE )?/i, '').trim();
    if (material === '') material = 'OUTROS';

    const chapa = row[keyChapa] ? String(row[keyChapa]).trim() : '-';

    // Valores
    const revenue = cleanNum(row[keyRev]); // Valor Líquido
    
    // Se não achou coluna de Bruto, usa o Líquido como Bruto (frete zero)
    // Se achou, usa o valor da coluna
    const grossTotal = keyGross ? cleanNum(row[keyGross]) : revenue; 
    
    const cost = cleanNum(row[keyCost]);
    const m2_total = cleanNum(row[keyM2]);

    // Cálculo do Frete (Bruto - Líquido)
    // Garante que não seja negativo
    const freight = Math.max(0, grossTotal - revenue);
    
    // Se por acaso o Bruto for menor que o líquido (erro na planilha), zera o frete
    // e assume que o Bruto é igual ao Líquido para não quebrar o DRE
    
    const price_per_m2 = m2_total > 0 ? revenue / m2_total : 0;
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
      revenue, // Salva o Líquido
      cost,
      freight, // Salva a diferença
      m2_total,
      price_per_m2,
      type
    };
  }).filter(item => item !== null); // Remove os nulos (linhas inválidas)
}