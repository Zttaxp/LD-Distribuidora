'use server'

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import * as XLSX from 'xlsx';

// --- CONFIGURAÇÕES GERAIS ---
export async function updateSettings(settings) {
  const supabase = await createClient();
  
  try {
    const { error } = await supabase
      .from('app_settings')
      .update({
        tax_rate: Number(settings.tax_rate),
        comm_rate: Number(settings.comm_rate),
        bad_debt_rate: Number(settings.bad_debt_rate),
        updated_at: new Date()
      })
      .eq('id', settings.id || 1);

    if (error) throw new Error(error.message);
    revalidatePath('/');
    return { success: true };
  } catch (err) {
    return { success: false, message: `Erro ao salvar configurações: ${err.message}` };
  }
}

// --- DESPESAS (BLINDADO CONTRA ERRO DE RENDER) ---
export async function addExpense(expense) {
  try {
    const supabase = await createClient();
    
    // 1. Limpeza robusta do valor (previne erro de texto/vírgula)
    let cleanValue = 0;
    const rawValue = expense.value;

    if (typeof rawValue === 'number') {
      cleanValue = rawValue;
    } else if (typeof rawValue === 'string') {
      // Troca vírgula por ponto e remove espaços
      cleanValue = parseFloat(rawValue.replace(/\./g, '').replace(',', '.'));
    }

    // Se a conversão falhou (ex: digitou texto), retorna erro controlado
    if (isNaN(cleanValue)) {
      return { success: false, message: "O valor informado não é um número válido." };
    }

    // 2. Tenta inserir no banco
    const { data, error } = await supabase
      .from('expenses')
      .insert([{
        name: expense.name,
        value: cleanValue,
        type: expense.type,
        month_key: expense.type === 'VARIABLE' ? expense.month_key : null
      }])
      .select()
      .single();

    if (error) {
      console.error("Erro Supabase:", error);
      return { success: false, message: "Erro no banco de dados: " + error.message };
    }
    
    // 3. Atualiza a tela
    revalidatePath('/');
    return { success: true, data };

  } catch (err) {
    console.error("Erro Fatal (Server Action):", err);
    // Retorna um erro amigável em vez de quebrar a tela preta
    return { success: false, message: "Erro interno ao processar a despesa." };
  }
}

export async function deleteExpense(id) {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) throw error;
    revalidatePath('/');
    return { success: true };
  } catch (err) {
    return { success: false, message: "Erro ao apagar despesa." };
  }
}

// --- CENÁRIOS MANUAIS ---
export async function saveManualScenario(data) {
  const supabase = await createClient();
  try {
    const { error } = await supabase
      .from('manual_scenarios')
      .upsert(data, { onConflict: 'month_key' });

    if (error) throw error;
    revalidatePath('/');
    return { success: true };
  } catch (err) {
    return { success: false, message: "Erro ao salvar cenário." };
  }
}

export async function getManualScenario(monthKey) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('manual_scenarios')
    .select('*')
    .eq('month_key', monthKey)
    .single();
  return data || null;
}

// --- VENDEDORES & METAS ---
export async function saveSellerGoal(sellerName, monthKey, value) {
  const supabase = await createClient();
  try {
    let cleanValue = value;
    if (typeof value === 'string') cleanValue = parseFloat(value.replace(',', '.'));
    
    const { error } = await supabase
      .from('seller_goals')
      .upsert({ 
        seller_name: sellerName, 
        month_key: monthKey, 
        goal_value: cleanValue 
      }, { onConflict: 'seller_name, month_key' });

    if (error) throw error;
    revalidatePath('/');
    return { success: true };
  } catch (err) {
    return { success: false, message: "Erro ao salvar meta." };
  }
}

export async function getSellerDetails(seller, month, year) {
  const supabase = await createClient();
  const monthKey = `${year}-${month}`;

  const { data: sales, error } = await supabase
    .from('sales')
    .select('*')
    .eq('seller', seller)
    .eq('year', year)
    .eq('month', month);

  if (error) throw new Error('Erro ao buscar vendas: ' + error.message);

  const { data: goalData } = await supabase
    .from('seller_goals')
    .select('goal_value')
    .eq('seller_name', seller)
    .eq('month_key', monthKey)
    .single();

  return {
    sales: sales || [],
    goal: goalData?.goal_value || 0
  };
}

// --- BUSCA DE VENDAS MENSAIS (RANKING MATERIAIS) ---
export async function getMonthlySalesData(month, year) {
  // ATENÇÃO: Usamos o createClient() padrão que já importamos no topo
  const supabase = await createClient();
  
  // Converte para número para garantir que o filtro funcione nas colunas INT
  const m = Number(month);
  const y = Number(year);

  const { data, error } = await supabase
    .from('sales')
    .select('material, m2_total, revenue, freight')
    .eq('month', m)
    .eq('year', y);

  if (error) {
    console.error(`Erro ao buscar vendas ${m}/${y}:`, error);
    return [];
  }
  
  return data || [];
}

export async function processUpload(formData) {
  const supabase = await createClient();
  const file = formData.get('file');

  if (!file) return { success: false, message: 'Nenhum arquivo enviado.' };

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);

    if (rows.length === 0) return { success: false, message: 'Planilha vazia.' };

    const formattedData = rows.map(row => {
      // 1. Tratamento de Data Robusto
      let dateObj = new Date();
      
      // Se vier como número serial do Excel (ex: 45260)
      if (typeof row.Data === 'number') {
        dateObj = new Date(Math.round((row.Data - 25569) * 86400 * 1000));
      } 
      // Se vier como string (ex: "01/12/2025" ou "2025-12-01")
      else if (typeof row.Data === 'string') {
        if (row.Data.includes('/')) {
            const [d, m, y] = row.Data.split('/');
            dateObj = new Date(`${y}-${m}-${d}`);
        } else {
            dateObj = new Date(row.Data);
        }
      }

      // Verifica se a data é válida, se não, usa hoje (fallback de segurança)
      if (isNaN(dateObj.getTime())) { 
          dateObj = new Date(); 
      }

      // 2. Extração Explícita de Mês/Ano (O SEGREDO PARA OS FILTROS FUNCIONAREM)
      // getMonth() retorna 0-11, então somamos 1
      const month = dateObj.getMonth() + 1; 
      const year = dateObj.getFullYear();
      const monthKey = `${year}-${month}`;

      // 3. Tratamento de Valores Numéricos
      // Remove "R$", troca vírgula por ponto, etc.
      const cleanNum = (val) => {
          if (typeof val === 'number') return val;
          if (typeof val === 'string') return parseFloat(val.replace('R$', '').replace(/\./g, '').replace(',', '.').trim()) || 0;
          return 0;
      };

      const revenue = cleanNum(row.PrecoUnit || row.Valor || 0);
      const freight = cleanNum(row.Frete || 0); // Ajuste conforme nome da coluna no seu Excel
      const cost = cleanNum(row.Custo || 0);    // Ajuste conforme nome da coluna

      return {
        date: dateObj.toISOString(),
        client: (row.Cliente || 'Consumidor Final').toUpperCase(),
        seller: (row.Vendedor || 'Loja').toUpperCase(),
        material: (row.Material || 'Diversos').toUpperCase(),
        chapa: row.Chapa ? String(row.Chapa) : null,
        m2_total: cleanNum(row.M2 || row.Metragem || 0),
        revenue: revenue,
        freight: freight,
        cost: cost,
        
        // CAMPOS CRÍTICOS PARA OS FILTROS:
        month: month, 
        year: year,
        month_key: monthKey
      };
    });

    // Inserção no Banco
    const { error } = await supabase.from('sales').insert(formattedData);

    if (error) throw error;

    revalidatePath('/');
    return { success: true, count: formattedData.length };

  } catch (error) {
    console.error('Erro no upload:', error);
    return { success: false, message: 'Erro ao processar planilha: ' + error.message };
  }
}

// --- RANKING GERAL DE VENDEDORES (NOVO) ---
export async function getSellersRanking(month, year) {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('sales')
    .select('seller, revenue, m2_total')
    .eq('month', month)
    .eq('year', year);

  if (error || !data) return [];

  const grouped = data.reduce((acc, curr) => {
     const seller = (curr.seller || 'DESCONHECIDO').toUpperCase();
     if (!acc[seller]) acc[seller] = { name: seller, totalRev: 0, highRev: 0 };
     
     const rev = Number(curr.revenue || 0);
     const m2 = Number(curr.m2_total || 0);
     
     // Checagem de Alto Valor (> 300) linha a linha
     const price = m2 > 0 ? rev / m2 : 0;
     
     acc[seller].totalRev += rev;
     if (price > 300) acc[seller].highRev += rev;
     
     return acc;
  }, {});

  // Retorna ordenado por Faturamento Total
  return Object.values(grouped).sort((a, b) => b.totalRev - a.totalRev);
}