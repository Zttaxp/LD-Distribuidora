import * as XLSX from 'xlsx';

export function parseExcelData(jsonData) {
  return jsonData.map(row => {
    const dateVal = row['DataVenda'] || row['Data'] || row['Dt. Venda'];
    const seller = row['Vendedor'] || row['VendedorNome'];
    const material = row['Material'] || row['Produto'] || row['Descricao'];
    const revenue = row['PrecoUnit'] || row['Valor'] || row['ValorTotalDocumento'] || 0;
    const cost = row['CustoTotalM2'] || row['Custo'] || 0;
    const m2 = row['Total_M2_Venda'] || row['Qtd'] || row['M2'] || 0;
    const freight = row['Frete'] || 0;
    const chapa = row['NroChapa'] || row['Chapa'] || '';
    const client = row['Cliente'] || row['ClienteNome'] || 'Consumidor';

    if (!dateVal || !revenue) return null;

    let finalDate = new Date();
    if (typeof dateVal === 'number') {
      finalDate = new Date(Math.round((dateVal - 25569) * 86400 * 1000));
    } else {
      finalDate = new Date(dateVal);
    }

    const cleanNum = (val) => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        let str = String(val).replace('R$', '').trim();
        if (str.includes(',') && str.includes('.')) str = str.replace('.', '').replace(',', '.');
        else if (str.includes(',')) str = str.replace(',', '.');
        return parseFloat(str) || 0;
    };

    return {
      date: finalDate.toISOString(),
      seller: String(seller || 'Indefinido').toUpperCase().trim(),
      client: String(client || 'Consumidor').trim(),
      material: String(material || 'Outros').trim(),
      chapa: String(chapa).trim(),
      revenue: cleanNum(revenue),
      cost: cleanNum(cost),
      freight: cleanNum(freight),
      m2_total: cleanNum(m2)
    };
  }).filter(item => item !== null);
}