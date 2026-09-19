const path = require("path");
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const fs = require("fs");
const { calcularPrecoVendaShopee } = require("./calculadora");
const { processarEstoquePDF } = require("./leitor-pdf");

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
if (!OPENROUTER_API_KEY) {
  console.error("Erro: defina OPENROUTER_API_KEY no arquivo .env.");
  process.exit(1);
}

// ARQUITETURA HA: Rotação de clusters para bypass automático de Rate Limit
const MODEL_POOL = [
  "qwen/qwen3.8-27b:free",
  "liquid/lfm-2.5-2.6b:free",
  "nvidia/nemotron-3.5-lightning:free",
  "z-ai/glm-5.2:free"
];

const PASTA_DATA = path.join(__dirname, '../data');
const INPUT_FILE = path.join(PASTA_DATA, process.argv[2] || "produtos-vonixx.json");
const OUTPUT_FILE = path.join(PASTA_DATA, "shopee-produtos.csv");
const REPORT_FILE = path.join(PASTA_DATA, "relatorio-revisao.md");
const FALTANTES_FILE = path.join(PASTA_DATA, "produtos-faltantes.json");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// MOTOR RESILIENTE: Abstração que reduziu o tamanho do seu código
async function rotacionarRequisicao(prompt, contexto) {
  for (const modelo of MODEL_POOL) {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": "http://localhost:3000",
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({
        model: modelo,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.choices && data.choices.length > 0) return data.choices[0].message.content;
    }
    // Se não for OK (429 ou 404), o loop ignora e tenta o próximo modelo do array
  }
  throw new Error(`SPOF: Todos os clusters falharam durante [${contexto}].`);
}

async function gerarConteudo(produto) {
  const prompt = `Você é um Copywriter Especialista em Algoritmo da Shopee e um Master Detailer Automotivo.
Seu objetivo é gerar metadados de listagem que maximizem o CTR (cliques) e a conversão de vendas.

DADOS DO PRODUTO (Base):
- Nome Comercial: ${produto.nome_limpo}
- Marca: ${produto.marca}
- Volume/Tamanho: ${produto.volume || "não informado"}
- Função: ${produto.funcao}

DIRETRIZES DE ENGENHARIA DE VENDAS (Siga rigorosamente):

1. TÍTULO SEO (Alta relevância na busca da Shopee):
   - Estrutura obrigatória: [Nome Comercial] [Volume] [Marca] - [Função Principal] + [Palavras-chave de Cauda Longa].
   - Exemplo perfeito: "Tok Final 500ml Vonixx - Cera Automotiva Líquida Brilho Rápido E Proteção".
   - Limite estendido: Entre 60 e 100 caracteres. NUNCA omita a Marca e o Nome Comercial.

2. DESCRIÇÃO ESTRUTURADA (O cliente de Estética Automotiva é técnico):
   - Formate o texto de saída para JSON usando '\\n' para quebras de linha reais. 
   - Proibido "textões" genéricos. Use a estrutura visual abaixo com os exatos emojis de cabeçalho:
   
   🏆 O QUE É O PRODUTO?
   (1 a 2 parágrafos densos sobre a formulação, ex: polímeros, carnaúba, sílica, e o resultado final).
   
   ✨ BENEFÍCIOS E CARACTERÍSTICAS:
   - (4 a 5 bullet points técnicos: durabilidade em meses, se contém abrasivos, nível de brilho, hidrorepelência).
   
   🛠️ MODO DE USO:
   1. (Passo a passo numerado, prático e exato da aplicação).
   2. (Tempo de cura ou como fazer o lustro/acabamento).
   
   📊 INFORMAÇÕES ADICIONAIS:
   (Indique se o produto precisa ser diluído, se está pronto para uso, e estimativa de rendimento).

3. REGRAS DE SAÍDA:
   - Nenhuma menção a preço, frete ou garantias fictícias.
   - Retorne APENAS o JSON, sem marcadores de código (\`\`\`json) ou textos adicionais.

{
  "titulo": "",
  "descricao": "",
  "categoria_sugerida": "Automotivo > Cuidados Automotivos > Exterior",
  "tags_busca": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "peso_estimado_g": 500,
  "dimensoes_estimadas_cm": "10x10x20",
  "sku_sugerido": "MARCA-NOME-VOLUME",
  "preco_mercado_estimado": 65.90
}`;

  let rawText = await rotacionarRequisicao(prompt, "Geração de Copy");
  
  // Limpeza robusta caso a LLM insista em enviar formatação Markdown
  rawText = rawText.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```$/s, "").trim();

  try {
    return JSON.parse(rawText);
  } catch (e) {
    console.error(`[FALHA DE PARSE JSON] Produto: ${produto.nome_limpo}`);
    return { 
      titulo: `${produto.nome_limpo} ${produto.volume || ''} ${produto.marca} - Original`, 
      descricao: "Produto original com nota fiscal.\\nConsulte o rótulo para instruções de uso.", 
      categoria_sugerida: "Automotivo", 
      tags_busca: [produto.marca, "estética automotiva"], 
      peso_estimado_g: 500,
      dimensoes_estimadas_cm: "10x10x20",
      sku_sugerido: `${produto.marca}-${produto.nome_limpo}`.toUpperCase().replace(/\s+/g, '-'),
      preco_mercado_estimado: 0 
    };
  }
} 

function csvEscape(valor) {
  const str = String(valor ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

async function revisarLote(itensGerados) {
  if (itensGerados.length === 0) return "Nenhum item para revisar.";
  const resumo = itensGerados.map((item, i) => `${i + 1}. ${item.nome_original} | título: "${item.titulo_shopee}"`).join("\n");

  const prompt = `Audite este lote de produtos automotivos. 
Lote:\n${resumo}\n\nSe estiver 100% aprovado, responda EXATAMENTE: "Nenhuma inconsistência encontrada." Se houver falhas, retorne uma tabela Markdown.`;

  try {
    return await rotacionarRequisicao(prompt, "Auditoria");
  } catch (error) {
    return "Erro na revisão final: API indisponível.";
  }
}

async function processarProduto(produto, itensGerados) {
  const conteudo = await gerarConteudo(produto);
  const precisaRevisar = produto.funcao_confirmada ? "não" : "SIM";
  const custoFornecedor = parseFloat(produto.preco_custo); 
  const precoVendaCalculado = calcularPrecoVendaShopee(custoFornecedor, 0.25); 
  
  const linhaCSV = [
    csvEscape(produto.nome_estoque), csvEscape(conteudo.titulo), csvEscape(conteudo.descricao), 
    csvEscape(conteudo.categoria_sugerida), csvEscape((conteudo.tags_busca || []).join("; ")), 
    conteudo.peso_estimado_g ?? "", csvEscape(conteudo.dimensoes_estimadas_cm),
    csvEscape(conteudo.sku_sugerido), precoVendaCalculado, conteudo.preco_mercado_estimado || "",
    produto.estoque, precisaRevisar
  ].join(",");

  fs.appendFileSync(OUTPUT_FILE, linhaCSV + "\n", "utf-8");
  itensGerados.push({ nome_original: produto.nome_estoque, titulo_shopee: conteudo.titulo, categoria_sugerida: conteudo.categoria_sugerida, preco_venda: precoVendaCalculado, precisa_revisar: precisaRevisar });
}

async function main() {
  // 🚩 FEATURE FLAG DE SEGURANÇA (Mude para false quando for rodar o lote completo)
  const MODO_TESTE = true; 

  // O INPUT_FILE agora é o PDF que vem dinamicamente do Upload do React
  const produtos = await processarEstoquePDF(INPUT_FILE);
  const itensGerados = [];
  let filaFalhas = [];
  let skusJaProcessados = new Set();
  const cabecalho = "nome_original,titulo_shopee,descricao_shopee,categoria_sugerida,tags_busca,peso_estimado_g,dimensoes_estimadas_cm,sku_sugerido,preco_venda_calculado,preco_mercado_ia,estoque,precisa_revisar\n"; 

  if (fs.existsSync(OUTPUT_FILE)) {
      const conteudoAtual = fs.readFileSync(OUTPUT_FILE, 'utf-8');
      if (conteudoAtual.trim().length > 0) {
          const linhas = conteudoAtual.split('\n').slice(1);
          linhas.forEach(linha => {
              if (linha.trim()) skusJaProcessados.add(linha.split(',')[0].replace(/^"|"$/g, ''));
          });
      } else fs.writeFileSync(OUTPUT_FILE, cabecalho, "utf-8"); 
  } else fs.writeFileSync(OUTPUT_FILE, cabecalho, "utf-8"); 

  let produtosPendentes = produtos.filter(p => !skusJaProcessados.has(p.nome_estoque));
  
  if (produtosPendentes.length === 0) {
      console.log("[SYS] O CSV já possui todos os dados solicitados.");
      return;
  }

  // 🛡️ TRAVA DE TESTE UNITÁRIO
  if (MODO_TESTE) {
      console.log("\n[QA] 🧪 MODO TESTE ATIVADO: Isolando apenas 1 produto para proteger a fila principal.");
      produtosPendentes = produtosPendentes.slice(0, 1);
  }

  console.log(`[SYS] ${skusJaProcessados.size} produtos identificados no banco local.`);
  console.log(`[SYS] Processando delta de ${produtosPendentes.length} pendentes via Rotação de Clusters...\n`);

  for (const [i, produto] of produtosPendentes.entries()) {
    process.stdout.write(`  [${i + 1}/${produtosPendentes.length}] ${produto.nome_limpo}... `);
    try {
      await processarProduto(produto, itensGerados);
      console.log("OK");
    } catch (err) {
      console.log("ERRO:", err.message);
      filaFalhas.push(produto);
    }
    if (i < produtosPendentes.length - 1) await sleep(1500); 
  }

  if (filaFalhas.length > 0) {
    console.log(`\n[!] Repescagem para ${filaFalhas.length} nós corrompidos...`);
    const falhasFinais = [];
    for (const [i, produto] of filaFalhas.entries()) {
      process.stdout.write(`  [REPESCAGEM ${i + 1}/${filaFalhas.length}] ${produto.nome_limpo}... `);
      try {
        await processarProduto(produto, itensGerados);
        console.log("OK");
      } catch (err) {
        console.log("FALHA CRÍTICA:", err.message);
        falhasFinais.push(produto);
      }
      await sleep(1500); 
    }
    if (falhasFinais.length > 0) fs.writeFileSync(FALTANTES_FILE, JSON.stringify(falhasFinais, null, 2), "utf-8");
  }

  if (itensGerados.length > 0) {
      console.log("\n[SYS] Disparando auditoria do lote...");
      const relatorio = await revisarLote(itensGerados);
      fs.appendFileSync(REPORT_FILE, `\n\n## Auditoria Automática\n\n${relatorio}\n`, "utf-8");
      console.log(`[SYS] Processo 100% finalizado. CSV e Relatório salvos.`);
  }
}

main().catch(err => { console.error("Falha no thread principal:", err); process.exit(1); });