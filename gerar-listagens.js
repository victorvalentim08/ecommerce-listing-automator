/**
 * gerar-listagens.js
 *
 * Lê produtos-vonixx.json, gera título + descrição + categoria sugerida
 * e exporta um CSV pronto para o "Cadastro em Massa" da Shopee.
 */

const fs = require("fs");

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error("Erro: defina a variável de ambiente GEMINI_API_KEY antes de rodar.");
  process.exit(1);
}

// Retornando ao modelo validado pela sua chave no log anterior
const GEMINI_MODEL = "gemini-3.6-flash"; 

const INPUT_FILE = process.argv[2] || "produtos-vonixx.json";
const OUTPUT_FILE = "shopee-produtos.csv";
const REPORT_FILE = "relatorio-revisao.md";

// Helper para pausas limpas
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function gerarConteudo(produto, tentativa = 1) {
  const MAX_TENTATIVAS = 3;
  const precoSeguro = Number(produto.preco_venda || 0).toFixed(2);
  
  const prompt = `Você é um especialista em copywriting para e-commerce (Shopee) focado em produtos automotivos.
Crie os dados de listagem para o seguinte produto:
- Nome: ${produto.nome_limpo}
- Marca: ${produto.marca}
- Volume/Tamanho: ${produto.volume || "não informado"}
- Função: ${produto.funcao}
- Preço de venda: R$ ${precoSeguro}

Preencha o JSON de resposta seguindo exatamente esta estrutura e regras:
{
  "titulo": "Título com até 60 caracteres (Marca + Produto + Volume + Palavra-chave)",
  "descricao": "Descrição de venda persuasiva (3 a 5 linhas), destacando benefícios, modo de uso e gerando confiança. Máximo 2 emojis.",
  "categoria_sugerida": "Categoria completa da Shopee (ex: Automotivo > Limpeza e Cuidados do Carro > Lavagem)",
  "tags_busca": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "peso_estimado_g": estimativa em gramas (apenas número inteiro),
  "dimensoes_estimadas_cm": "estimativa (ex: 10x10x20)",
  "sku_sugerido": "MARCA-NOME-VOLUME sem espaços"
}

Observação: Se a função contiver "REVISAR", inicie a descrição com "[REVISAR FUNÇÃO ANTES DE PUBLICAR]".`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${API_KEY}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { 
        maxOutputTokens: 1500,
        responseMimeType: "application/json"
      },
    }),
  });

  if ((response.status === 503 || response.status === 429) && tentativa < MAX_TENTATIVAS) {
    console.log(`\n(Limite da API. Aguardando 15s para a tentativa ${tentativa + 1}...)`);
    await sleep(30000);
    return gerarConteudo(produto, tentativa + 1);
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Erro na API (${produto.nome_limpo}): ${errText}`);
  }

  const data = await response.json();
  let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  
  // Limpeza de segurança extra caso a IA envie formatação markdown ignorando o MIME Type
  rawText = rawText.replace(/```(?:json)?|```/g, "").trim();

  try {
    return JSON.parse(rawText);
  } catch (e) {
    if (tentativa < MAX_TENTATIVAS) {
      console.log(`\n(Falha no Parse. Aguardando 5s para refazer...)`);
      await sleep(5000);
      return gerarConteudo(produto, tentativa + 1);
    }
    console.error(`Falha irreparável ao interpretar produto "${produto.nome_limpo}":`, rawText);
    return {
      titulo: produto.nome_limpo,
      descricao: "[ERRO NA GERAÇÃO - revisar manualmente]",
      categoria_sugerida: "",
      tags_busca: [],
    };
  }
}

function csvEscape(valor) {
  const str = String(valor ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function revisarLote(itensGerados, tentativa = 1) {
  const MAX_TENTATIVAS = 3;
  const resumo = itensGerados
    .map(
      (item, i) =>
        `${i + 1}. ${item.nome_original} | título: "${item.titulo_shopee}" | categoria: "${item.categoria_sugerida}" | preço: R$${item.preco_venda} | peso: ${item.peso_estimado_g}g | precisa_revisar: ${item.precisa_revisar}`
    )
    .join("\n");

  const prompt = `Você é um auditor de qualidade de e-commerce. Revise esta lista de produtos para a Shopee e aponte inconsistências (títulos genéricos, preços absurdos, pesos implausíveis).
Lista:
${resumo}

Responda em Markdown com um bullet point por problema encontrado. Se tudo estiver perfeito, responda apenas: "Nenhuma inconsistência encontrada."`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${API_KEY}`;
  
  if (tentativa === 1) {
      console.log("\nEsfriando a cota da API por 15s antes da revisão final...");
      await sleep(15000);
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 1000 },
    }),
  });

  if ((response.status === 503 || response.status === 429) && tentativa < MAX_TENTATIVAS) {
    console.log(`\n(Revisão: cota excedida, esperando 15s...)`);
    await sleep(15000);
    return revisarLote(itensGerados, tentativa + 1);
  }

  if (!response.ok) {
    return `Não foi possível gerar a revisão: ${await response.text()}`;
  }
  
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "Sem resposta do auditor.";
}

async function main() {
  const produtos = JSON.parse(fs.readFileSync(INPUT_FILE, "utf-8"));
  console.log(`Iniciando geração para ${produtos.length} produtos...`);

  const linhas = [
    "nome_original,titulo_shopee,descricao_shopee,categoria_sugerida,tags_busca,peso_estimado_g,dimensoes_estimadas_cm,sku_sugerido,preco_venda,estoque,precisa_revisar",
  ];
  const itensGerados = [];

  for (const [i, produto] of produtos.entries()) {
    process.stdout.write(`  [${i + 1}/${produtos.length}] ${produto.nome_limpo}... `);
    try {
      const conteudo = await gerarConteudo(produto);
      const precisaRevisar = produto.funcao_confirmada ? "não" : "SIM";
      
      linhas.push(
        [
          csvEscape(produto.nome_estoque),
          csvEscape(conteudo.titulo),
          csvEscape(conteudo.descricao),
          csvEscape(conteudo.categoria_sugerida),
          csvEscape((conteudo.tags_busca || []).join("; ")),
          conteudo.peso_estimado_g ?? "",
          csvEscape(conteudo.dimensoes_estimadas_cm),
          csvEscape(conteudo.sku_sugerido),
          produto.preco_venda,
          produto.estoque,
          precisaRevisar,
        ].join(",")
      );
      
      itensGerados.push({
        nome_original: produto.nome_estoque,
        titulo_shopee: conteudo.titulo,
        categoria_sugerida: conteudo.categoria_sugerida,
        preco_venda: produto.preco_venda,
        peso_estimado_g: conteudo.peso_estimado_g,
        precisa_revisar: precisaRevisar,
      });
      console.log("OK");
    } catch (err) {
      console.log("ERRO:", err.message);
    }
    
    // Trava de 5 segundos redondos
    if (i < produtos.length - 1) {
      await sleep(5000);
    }
  }

  fs.writeFileSync(OUTPUT_FILE, linhas.join("\n"), "utf-8");
  console.log(`\nCSV pronto para upload: ${OUTPUT_FILE}`);

  console.log("Acionando consultor de IA para revisão do lote...");
  const relatorio = await revisarLote(itensGerados);
  fs.writeFileSync(
    REPORT_FILE,
    `# Relatório de Revisão - ${new Date().toLocaleString("pt-BR")}\n\n${relatorio}\n\n---\n*Lembrete: peso e dimensões são estimativas. Verifique antes de subir na Shopee.*`,
    "utf-8"
  );
  console.log(`Relatório de anomalias salvo: ${REPORT_FILE}`);
}

main().catch((err) => {
  console.error("Falha crítica na execução:", err);
  process.exit(1);
});