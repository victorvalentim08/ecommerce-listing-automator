require('dotenv').config();
const fs = require("fs");
const { calcularPrecoVendaShopee } = require("./calculadora");

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
if (!OPENROUTER_API_KEY) {
  console.error("Erro: defina a variável de ambiente OPENROUTER_API_KEY no arquivo .env.");
  process.exit(1);
}

const OPENROUTER_MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free"; 

const INPUT_FILE = process.argv[2] || "produtos-vonixx.json";
const OUTPUT_FILE = "shopee-produtos.csv";
const REPORT_FILE = "relatorio-revisao.md";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function gerarConteudo(produto, tentativa = 1) {
  const MAX_TENTATIVAS = 5;
  
  // PROMPT CORRETO DO COPYWRITER PARA O PRODUTO INDIVIDUAL
  const prompt = `Você é um especialista em copywriting para e-commerce (Shopee) focado em produtos automotivos.
Crie os dados de listagem para o seguinte produto:
- Nome: ${produto.nome_limpo}
- Marca: ${produto.marca}
- Volume/Tamanho: ${produto.volume || "não informado"}
- Função: ${produto.funcao}

REGRA DE OURO: NUNCA mencione o valor financeiro ou preço do produto no texto, pois os valores podem mudar. Foque exclusivamente nos benefícios, rendimento e modo de uso.

Preencha o JSON de resposta seguindo exatamente esta estrutura. Retorne APENAS o JSON válido, sem textos antes ou depois, sem formatação markdown:
{
  "titulo": "Título com até 60 caracteres (Marca + Produto + Volume + Palavra-chave)",
  "descricao": "Descrição de venda persuasiva (3 a 5 linhas), destacando benefícios, modo de uso e gerando confiança. Máximo 2 emojis.",
  "categoria_sugerida": "Categoria completa da Shopee (ex: Automotivo > Limpeza e Cuidados do Carro > Lavagem)",
  "tags_busca": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "peso_estimado_g": 500,
  "dimensoes_estimadas_cm": "10x10x20",
  "sku_sugerido": "MARCA-NOME-VOLUME",
  "preco_mercado_estimado": 65.90
}

Observação: Se a função contiver "REVISAR", inicie a descrição com "[REVISAR FUNÇÃO ANTES DE PUBLICAR]".`;

  const url = "https://openrouter.ai/api/v1/chat/completions";

  const response = await fetch(url, {
    method: "POST",
    headers: { 
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer": "http://localhost:3000",
      "Content-Type": "application/json" 
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3
    }),
  });

  if (response.status === 429 && tentativa < MAX_TENTATIVAS) {
    console.log(`\n(Limite da API OpenRouter. Aguardando 5s para a tentativa ${tentativa + 1}...)`);
    await sleep(5000);
    return gerarConteudo(produto, tentativa + 1);
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Erro na API HTTP ${response.status}: ${errText}`);
  }

  const data = await response.json();
  
  if (!data.choices || data.choices.length === 0) {
    if (tentativa < MAX_TENTATIVAS) {
      console.log(`\n(Servidor retornou vazio. Aguardando 3s para tentativa ${tentativa + 1}...)`);
      await sleep(3000);
      return gerarConteudo(produto, tentativa + 1);
    }
    throw new Error(`Falha estrutural do OpenRouter após ${MAX_TENTATIVAS} tentativas: ${JSON.stringify(data)}`);
  }

  let rawText = data.choices[0].message.content || "{}";
  rawText = rawText.replace(/```(?:json)?|```/g, "").trim();

  try {
    return JSON.parse(rawText);
  } catch (e) {
    if (tentativa < MAX_TENTATIVAS) {
      console.log(`\n(Falha no Parse JSON. Aguardando 3s para tentativa ${tentativa + 1}...)`);
      await sleep(3000);
      return gerarConteudo(produto, tentativa + 1);
    }
    return { titulo: produto.nome_limpo, descricao: "[ERRO NA GERAÇÃO - revisar manualmente]", categoria_sugerida: "", tags_busca: [], preco_mercado_estimado: "" };
  }
}

function csvEscape(valor) {
  const str = String(valor ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

async function revisarLote(itensGerados, tentativa = 1) {
  if (itensGerados.length === 0) return "Nenhum item para revisar.";
  
  const MAX_TENTATIVAS = 3;
  const resumo = itensGerados.map((item, i) => `${i + 1}. ${item.nome_original} | título: "${item.titulo_shopee}" | categoria: "${item.categoria_sugerida}" | preço base: R$${item.preco_venda}`).join("\n");

  // PROMPT CORRETO DO AUDITOR NO LUGAR CERTO
  const prompt = `Você é o Coordenador Sênior de Operações da Shopee, especialista em Estética Automotiva.
Missão: Auditar o lote de produtos Vonixx abaixo com rigor absoluto.

CRITÉRIOS DE FALHA (Aponte APENAS se violar estas regras):
1. Categoria: Incompatível com a taxonomia padrão de Cuidados Automotivos.
2. SEO (Título): Faltando o padrão "Marca + Linha + Função + Volume", contendo spam de palavras-chave, ou muito distante do limite ideal de 60 caracteres.
3. Precificação: Valores de custo/atacado listados como varejo (ex: galões de 5L por menos de R$ 100, ou produtos premium Vonixx de 500ml por menos de R$ 35).

Lote para auditoria:
${resumo}

DIRETRIZES DE SAÍDA (COMPLIANCE ESTRITO):
- ZERO texto adicional. Sem saudações, sem explicações, sem blocos de código (\`\`\`).
- Se o lote estiver 100% aprovado, responda EXATAMENTE: "Nenhuma inconsistência encontrada."
- Se houver falhas, retorne EXATAMENTE uma tabela Markdown com as colunas:
| Produto | Tipo (SEO/Preço/Categoria) | Problema Encontrado | Solução Prática |`;

  const url = "https://openrouter.ai/api/v1/chat/completions";
  
  if (tentativa === 1) {
      console.log("\nEsfriando a conexão por 5s antes da revisão final...");
      await sleep(5000);
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { 
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer": "http://localhost:3000",
      "Content-Type": "application/json" 
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3
    }),
  });

  if (response.status === 429 && tentativa < MAX_TENTATIVAS) {
    console.log(`\n(Revisão: cota excedida, esperando 10s...)`);
    await sleep(10000);
    return revisarLote(itensGerados, tentativa + 1);
  }

  if (!response.ok) return `Erro na revisão: ${await response.text()}`;
  const data = await response.json();
  if (!data.choices || data.choices.length === 0) return "Auditor retornou resposta vazia.";
  
  return data.choices[0].message.content || "Sem resposta do auditor.";
}

async function processarProduto(produto, itensGerados) {
  const conteudo = await gerarConteudo(produto);
  const precisaRevisar = produto.funcao_confirmada ? "não" : "SIM";
  
  const custoFornecedor = parseFloat(produto.preco_venda); 
  const precoVendaCalculado = calcularPrecoVendaShopee(custoFornecedor, 0.25); 
  
  const linhaCSV = [
    csvEscape(produto.nome_estoque), 
    csvEscape(conteudo.titulo), 
    csvEscape(conteudo.descricao), 
    csvEscape(conteudo.categoria_sugerida),
    csvEscape((conteudo.tags_busca || []).join("; ")), 
    conteudo.peso_estimado_g ?? "", 
    csvEscape(conteudo.dimensoes_estimadas_cm),
    csvEscape(conteudo.sku_sugerido), 
    precoVendaCalculado, 
    conteudo.preco_mercado_estimado || "",
    produto.estoque, 
    precisaRevisar
  ].join(",");

  fs.appendFileSync(OUTPUT_FILE, linhaCSV + "\n", "utf-8");
  itensGerados.push({ nome_original: produto.nome_estoque, titulo_shopee: conteudo.titulo, categoria_sugerida: conteudo.categoria_sugerida, preco_venda: precoVendaCalculado, precisa_revisar: precisaRevisar });
}

async function main() {
  const produtos = JSON.parse(fs.readFileSync(INPUT_FILE, "utf-8"));
  console.log(`Iniciando geração para ${produtos.length} produtos via OpenRouter...`);
  console.log(`(Modo de segurança e repescagem automática ativados)\n`);

  const cabecalho = "nome_original,titulo_shopee,descricao_shopee,categoria_sugerida,tags_busca,peso_estimado_g,dimensoes_estimadas_cm,sku_sugerido,preco_venda_calculado,preco_mercado_ia,estoque,precisa_revisar\n"; 
  fs.writeFileSync(OUTPUT_FILE, cabecalho, "utf-8");
  
  const itensGerados = [];
  let filaFalhas = [];

  for (const [i, produto] of produtos.entries()) {
    process.stdout.write(`  [${i + 1}/${produtos.length}] ${produto.nome_limpo}... `);
    try {
      await processarProduto(produto, itensGerados);
      console.log("OK (Salvo no CSV)");
    } catch (err) {
      console.log("ERRO:", err.message);
      filaFalhas.push(produto);
    }
    if (i < produtos.length - 1) await sleep(2000); 
  }

  if (filaFalhas.length > 0) {
    console.log(`\n[!] Iniciando repescagem automática para ${filaFalhas.length} produtos que falharam...`);
    const falhasFinais = [];
    
    for (const [i, produto] of filaFalhas.entries()) {
      process.stdout.write(`  [REPESCAGEM ${i + 1}/${filaFalhas.length}] ${produto.nome_limpo}... `);
      try {
        await processarProduto(produto, itensGerados);
        console.log("OK (Salvo no CSV)");
      } catch (err) {
        console.log("FALHA DEFINITIVA:", err.message);
        falhasFinais.push(produto);
      }
      await sleep(3000); 
    }
    
    if (falhasFinais.length > 0) {
      fs.writeFileSync("produtos-faltantes.json", JSON.stringify(falhasFinais, null, 2), "utf-8");
      console.log(`\n[AVISO] ${falhasFinais.length} produtos continuaram falhando. Eles foram salvos automaticamente em 'produtos-faltantes.json'.`);
    } else {
      console.log("\n[SUCESSO] Todos os produtos da repescagem foram salvos!");
    }
  }

  console.log(`\nCSV pronto e blindado: ${OUTPUT_FILE}`);
  console.log("Acionando consultor de IA para revisão do lote...");
  
  const relatorio = await revisarLote(itensGerados);
  fs.writeFileSync(REPORT_FILE, `# Relatório de Revisão\n\n${relatorio}\n`, "utf-8");
  console.log(`Relatório salvo: ${REPORT_FILE}`);
}

main().catch(err => { console.error("Falha crítica:", err); process.exit(1); });