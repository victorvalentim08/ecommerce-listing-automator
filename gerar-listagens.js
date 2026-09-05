/**
 * gerar-listagens.js
 *
 * Lê produtos-vonixx.json, gera título + descrição + categoria sugerida
 * pra cada produto usando a API GRATUITA do Gemini (Google AI Studio),
 * e exporta um CSV pronto pra subir no "Cadastro em Massa" (bulk upload)
 * da Central do Vendedor Shopee.
 *
 * Como pegar a chave grátis:
 *   1. Acesse https://aistudio.google.com/apikey (login com conta Google normal,
 *      não precisa do Gemini Pro pago nem cartão de crédito)
 *   2. Clique em "Create API Key"
 *   3. Copie a chave gerada
 *
 * Como usar:
 *   1. Node 18+ já tem fetch embutido, não precisa instalar nada
 *   2. export GEMINI_API_KEY="sua-chave-aqui"
 *   3. node gerar-listagens.js
 *
 * Saída: shopee-produtos.csv
 *
 * Reaproveitável: para gerar listagens de outros produtos (não-Vonixx),
 * só editar/duplicar o arquivo produtos-vonixx.json com o mesmo formato.
 *
 * Nota sobre o limite gratuito: o modelo usado aqui (gemini-2.5-flash) tem
 * cota diária grátis generosa (algumas centenas de requisições/dia), então
 * 18 produtos (ou mesmo o estoque todo) roda tranquilo sem gastar nada.
 * Se algum dia a cota estourar, a API só retorna erro 429 — nunca cobra
 * sem você ativar faturamento manualmente no Google Cloud.
 */

const fs = require("fs");

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error("Erro: defina a variável de ambiente GEMINI_API_KEY antes de rodar.");
  console.error("Pegue sua chave grátis em: https://aistudio.google.com/apikey");
  process.exit(1);
}

const GEMINI_MODEL = "gemini-2.5-flash"; // modelo do tier gratuito

const INPUT_FILE = process.argv[2] || "produtos-vonixx.json";
const OUTPUT_FILE = "shopee-produtos.csv";

async function gerarConteudo(produto) {
  const prompt = `Você é especialista em copywriting para e-commerce (Shopee) de produtos automotivos.

Dados do produto:
- Nome: ${produto.nome_limpo}
- Marca: ${produto.marca}
- Volume: ${produto.volume || "não informado"}
- Função: ${produto.funcao}
- Preço de venda: R$ ${produto.preco_venda.toFixed(2)}

Gere no formato JSON puro (sem markdown, sem texto antes ou depois), com as chaves:
{
  "titulo": "título otimizado para busca na Shopee, até 60 caracteres, formato: Marca + Produto + Volume + Palavra-chave de busca",
  "descricao": "descrição de venda com 3 a 5 linhas, destacando benefícios e modo de uso, tom direto e confiável, sem emojis em excesso (no máximo 2)",
  "categoria_sugerida": "categoria da Shopee mais adequada (ex: Automotivo > Limpeza e Cuidados do Carro > ...)",
  "tags_busca": ["até 5 palavras-chave relevantes para tags de busca"]
}

Se a função do produto estiver marcada como "REVISAR", gere um texto genérico de produto de limpeza automotiva Vonixx e adicione no campo "descricao" o aviso: "[REVISAR FUNÇÃO ANTES DE PUBLICAR]" no início.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${API_KEY}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 800 },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Erro na API (produto: ${produto.nome_limpo}): ${errText}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const cleanText = rawText.replace(/```json|```/g, "").trim();

  try {
    return JSON.parse(cleanText);
  } catch (e) {
    console.error(`Falha ao interpretar resposta pro produto "${produto.nome_limpo}":`, cleanText);
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

async function main() {
  const produtos = JSON.parse(fs.readFileSync(INPUT_FILE, "utf-8"));
  console.log(`Gerando conteúdo para ${produtos.length} produtos...`);

  const linhas = [
    "nome_original,titulo_shopee,descricao_shopee,categoria_sugerida,tags_busca,preco_venda,estoque,precisa_revisar",
  ];

  for (const [i, produto] of produtos.entries()) {
    process.stdout.write(`  [${i + 1}/${produtos.length}] ${produto.nome_limpo}... `);
    try {
      const conteudo = await gerarConteudo(produto);
      linhas.push(
        [
          csvEscape(produto.nome_estoque),
          csvEscape(conteudo.titulo),
          csvEscape(conteudo.descricao),
          csvEscape(conteudo.categoria_sugerida),
          csvEscape((conteudo.tags_busca || []).join("; ")),
          produto.preco_venda,
          produto.estoque,
          produto.funcao_confirmada ? "não" : "SIM",
        ].join(",")
      );
      console.log("ok");
    } catch (err) {
      console.log("ERRO:", err.message);
    }
    // pequena pausa pra não estourar rate limit
    await new Promise((r) => setTimeout(r, 300));
  }

  fs.writeFileSync(OUTPUT_FILE, linhas.join("\n"), "utf-8");
  console.log(`\nPronto! Arquivo gerado: ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error("Erro geral:", err);
  process.exit(1);
});