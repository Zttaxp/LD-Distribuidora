// app/api/upload/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { parseRows } from "../../../lib/parser"; // Importa nosso novo parser

export async function POST(request) {
  try {
    // 1. Conectar ao Supabase como ADMIN (para poder escrever no banco)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE
    );

    // 2. Receber o arquivo
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
    }

    // 3. Salvar arquivo original no Storage (Backup)
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileName = `uploads/${Date.now()}-${file.name}`;

    const uploadRes = await supabase.storage
      .from("uploads")
      .upload(fileName, fileBuffer, { contentType: file.type });

    if (uploadRes.error) {
      throw new Error("Erro ao salvar no storage: " + uploadRes.error.message);
    }

    // 4. Ler a planilha com XLSX
    const workbook = XLSX.read(fileBuffer, { type: "buffer", cellDates: true });
    // Pega a primeira aba da planilha
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    // Converte para JSON bruto
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

    // 5. USAR O PARSER (Lógica do seu HTML)
    const salesData = parseRows(jsonData);

    if (salesData.length === 0) {
      return NextResponse.json({ error: "Nenhuma linha válida encontrada na planilha." }, { status: 400 });
    }

    // 6. Criar registro do Dataset (Pacote de importação)
    const datasetRes = await supabase
      .from("datasets")
      .insert([
        {
          name: file.name,
          original_file_path: fileName,
          // user_id: aqui entra o ID do usuário quando tivermos login
        },
      ])
      .select()
      .single();

    if (datasetRes.error) {
      throw new Error("Erro ao criar dataset: " + datasetRes.error.message);
    }

    const datasetId = datasetRes.data.id;

    // 7. Inserir as vendas no banco (em lotes de 500 para não travar)
    const rowsToInsert = salesData.map(row => ({
      ...row,
      dataset_id: datasetId // Liga a venda ao dataset criado
    }));

    const chunkSize = 500;
    for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
      const chunk = rowsToInsert.slice(i, i + chunkSize);
      const insertRes = await supabase.from("sales").insert(chunk);
      
      if (insertRes.error) {
        console.error("Erro no chunk:", insertRes.error);
        // Não paramos o processo, mas logamos o erro
      }
    }

    return NextResponse.json({
      message: "Upload e processamento concluídos!",
      total_linhas: rowsToInsert.length,
      dataset_id: datasetId
    });

  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}