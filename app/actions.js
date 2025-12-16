'use server'

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

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

export async function getTopMaterials(month, year) {
  const supabase = createServerActionClient({ cookies });

  // CONSTRUÇÃO SEGURA DAS DATAS (Universal)
  // Data Inicial: Dia 01 do mês à meia-noite
  const startDate = `${year}-${String(month).padStart(2, '0')}-01T00:00:00.000Z`;
  
  // Data Final: Dia 01 do mês seguinte (para pegar até o último milissegundo do mês atual)
  let nextMonth = Number(month) + 1;
  let nextYear = Number(year);
  if (nextMonth > 12) {
      nextMonth = 1;
      nextYear = nextYear + 1;
  }
  const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00.000Z`;

  // Log para você ver no terminal do VS Code se está chegando os dados
  console.log(`🔍 Buscando Mix de Materiais: ${month}/${year} (Range: ${startDate} até ${endDate})`);

  // QUERY: Usa .gte (maior ou igual) e .lt (menor que) na coluna 'date'
  const { data, error } = await supabase
    .from('sales')
    .select('material, m2_total, revenue')
    .gte('date', startDate)
    .lt('date', endDate);

  if (error) {
    console.error("❌ Erro Supabase:", error);
    return { high: [], low: [] };
  }

  if (!data || data.length === 0) {
    console.warn("⚠️ Nenhum item de venda encontrado neste intervalo.");
    return { high: [], low: [] };
  }

  // LÓGICA DE AGRUPAMENTO (Mantida)
  const grouped = data.reduce((acc, curr) => {
    // Normaliza nome (remove espaços extras e deixa maiúsculo)
    const mat = (curr.material || 'INDEFINIDO').trim().toUpperCase();
    
    if (!acc[mat]) acc[mat] = { name: mat, m2: 0, revenue: 0 };
    
    // Converte para número para evitar erro de soma
    acc[mat].m2 += Number(curr.m2_total || 0);
    acc[mat].revenue += Number(curr.revenue || 0);
    return acc;
  }, {});

  const list = Object.values(grouped).map(item => ({
    ...item,
    price: item.m2 > 0 ? item.revenue / item.m2 : 0
  }));

  // Filtra e Ordena
  const high = list.filter(i => i.price > 300).sort((a, b) => b.revenue - a.revenue);
  const low = list.filter(i => i.price <= 300).sort((a, b) => b.revenue - a.revenue);

  console.log(`✅ Sucesso: ${high.length} itens Alto Valor, ${low.length} itens Baixo Valor.`);

  return { high, low };
}