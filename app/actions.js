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
  
  // Define intervalo do mês
  const startDate = new Date(year, month - 1, 1).toISOString();
  const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();

  // Busca apenas as colunas necessárias para performance
  const { data, error } = await supabase
    .from('sales')
    .select('material, m2_total, revenue')
    .gte('date', startDate)
    .lte('date', endDate);

  if (error || !data) return { high: [], low: [] };

  // Agrupa por nome do material
  const grouped = data.reduce((acc, curr) => {
    const mat = (curr.material || 'OUTROS').trim().toUpperCase();
    if (!acc[mat]) acc[mat] = { name: mat, m2: 0, revenue: 0 };
    
    acc[mat].m2 += Number(curr.m2_total || 0);
    acc[mat].revenue += Number(curr.revenue || 0); // Usa Revenue (Valor Pedra)
    return acc;
  }, {});

  const list = Object.values(grouped).map(item => ({
    ...item,
    price: item.m2 > 0 ? item.revenue / item.m2 : 0
  }));

  // Separação por Alto Valor (> 300) e Baixo Valor (<= 300)
  const high = list.filter(i => i.price > 300).sort((a, b) => b.revenue - a.revenue);
  const low = list.filter(i => i.price <= 300).sort((a, b) => b.revenue - a.revenue);

  return { high, low };
}