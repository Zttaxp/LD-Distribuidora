// lib/parser.js

// 1. Função para encontrar a coluna certa
function getKey(row, candidates) {
  const rowKeys = Object.keys(row || {});
  for (const c of candidates) {
    const exact = rowKeys.find(k => k.trim().toLowerCase() === c.toLowerCase());
    if (exact) return exact;
  }
  for (const c of candidates) {
    const match = rowKeys.find(k => {
      const cleanKey = k.trim().toLowerCase();
      if ((cleanKey.includes('cod') || cleanKey.includes('id')) && !c.toLowerCase().includes('cod')) return false;
      return cleanKey.includes(c.toLowerCase());
    });
    if (match) return match;
  }
  return null;
}

// 2. Limpeza Numérica (Necessária para o banco aceitar o valor)
function cleanNum(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  let s = String(v).replace(/[^\d.,-]/g, ''); // Mantém apenas números e pontuação
  s = s.replace(',', '.'); // Troca vírgula por ponto (padrão banco de dados)
  return parseFloat(s) || 0;
}

// 3. Tratamento de Data
function tryParseDate(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  if (!v) return null;
  const s = String(v).trim();
  const parts = s.split(/[\/\-]/); // Tenta dd/mm/aaaa
  if (parts.length === 3) {
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1;
      let year = parseInt(parts[2]);
      if (year < 100) year += 2000; 
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// 4. PARSER PRINCIPAL (Lógica do seu HTML)
export function parseRows(data) {
  return data.map(row => {
    // Mapeamento de colunas
    const keyDate = getKey(row, ['DataVenda', 'Data', 'Criacao', 'Emissao']);
    const keySeller = getKey(row, ['Vendedor', 'VendedorNome']);
    const keyClient = getKey(row, ['Cliente', 'ClienteNome']);
    const keyMaterial = getKey(row, ['Material', 'Produto', 'Descricao', 'Item']);
    const keyChapa = getKey(row, ['NroChapa', 'Chapa', 'NumChapa']);
    const keyCost = getKey(row, ['CustoTotalM2', 'Custo', 'CustoTotal']);
    const keyRev = getKey(row, ['PrecoUnit', 'ValorTotalDocumento', 'Valor', 'Vl Total', 'Total']);
    const keyGross = getKey(row, ['PrecoTotalBruto', 'ValorTotal', 'ValorBruto']); 
    const keyM2 = getKey(row, ['Total_M2_Venda', 'Qtd', 'M2', 'Metragem']);

    if (!keyDate || !keyRev) return null;

    const date = tryParseDate(row[keyDate]);
    if (!date) return null;

    // --- TEXTOS: Mantém idêntico à planilha (sem mudar maiúsculas/minúsculas) ---
    const seller = row[keySeller] ? String(row[keySeller]).trim() : 'DESCONHECIDO';
    const client = row[keyClient] ? String(row[keyClient]).trim() : 'CONSUMIDOR';
    const material = row[keyMaterial] ? String(row[keyMaterial]).trim() : 'MATERIAL INDEFINIDO'; 
    const chapa = row[keyChapa] ? String(row[keyChapa]).trim() : '-';

    // --- VALORES: Limpa para o banco aceitar ---
    const revenue = cleanNum(row[keyRev]);
    const cost = cleanNum(row[keyCost]);
    
    // Se não tiver coluna de Bruto, assume que Bruto = Líquido
    const grossTotal = keyGross ? cleanNum(row[keyGross]) : revenue; 
    const m2Total = cleanNum(row[keyM2]);

    // --- CÁLCULOS DO SEU HTML (Reativados) ---
    
    // 1. Cálculo de Frete (Diferença entre Bruto e Líquido)
    const freight = Math.max(0, grossTotal - revenue);
    
    // 2. Cálculo de Preço por M2
    const pricePerM2 = m2Total > 0 ? revenue / m2Total : 0;
    
    // 3. Classificação (Lógica do HTML: > 300 é HIGH)
    const type = pricePerM2 > 300 ? 'HIGH' : 'LOW';

    return {
      date: date.toISOString(),
      seller,
      client,
      material,
      chapa,
      revenue,
      cost,
      freight,     
      m2_total: m2Total,
      price_per_m2: pricePerM2, 
      type          
    };
  }).filter(x => x !== null);
}