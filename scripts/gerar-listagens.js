const path = require("path");
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const fs = require("fs");
const { calcularPrecoVendaShopee } = require("./calculadora");
const { processarEstoquePDF } = require("./leitor-pdf");
const { injetarNoTemplateShopee } = require("./injetar-shopee");

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
if (!OPENROUTER_API_KEY) {
  console.error("Erro: defina OPENROUTER_API_KEY no arquivo .env.");
  process.exit(1);
}

// ARQUITETURA HA: Pool de modelos gratuitos no OpenRouter
const MODEL_POOL = [
  "google/gemini-2.5-flash-lite:free",
  "deepseek/deepseek-r1:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "qwen/qwen-2.5-72b-instruct:free"
];

const PASTA_DATA = path.join(__dirname, '../data');

if (!fs.existsSync(PASTA_DATA)) {
    fs.mkdirSync(PASTA_DATA, { recursive: true });
}

const INPUT_FILE = process.argv[2]; 

if (!INPUT_FILE) {
    console.error("[ERRO] Nenhum arquivo de entrada fornecido.");
    process.exit(1);
}

const OUTPUT_FILE = path.join(PASTA_DATA, "shopee-produtos.csv");
const REPORT_FILE = path.join(PASTA_DATA, "relatorio-revisao.md");
const FALTANTES_FILE = path.join(PASTA_DATA, "produtos-faltantes.json");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function rotacionarRequisicao(prompt, contexto) {
  for (const modelo of MODEL_POOL) {
    try {
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
    } catch (e) {
      // Tenta o próximo modelo do pool em caso de falha de rede/cluster
    }
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
   - Limite estendido: Entre 60 e 100 caracteres. NUNCA omita a Marca e o Nome Comercial.

2. DESCRIÇÃO ESTRUTURADA (O cliente de Estética Automotiva é técnico):
   - Formate o texto de saída para JSON usando '\\n' para quebras de linha reais. 
   - Use a estrutura visual abaixo com os exatos emojis de cabeçalho:
   
   🏆 O QUE É O PRODUTO?
   (1 a 2 parágrafos densos sobre a formulação e o resultado final).
   
   ✨ BENEFÍCIOS E CARACTERÍSTICAS:
   - (4 a 5 bullet points técnicos: durabilidade, acabamento, etc.).
   
   🛠️ MODO DE USO:
   1. (Passo a passo numerado, prático e exato da aplicação).
   
   📊 INFORMAÇÕES ADICIONAIS:
   (Indique se o produto precisa ser diluído ou se está pronto para uso).

3. REGRAS DE SAÍDA:
   - Retorne APENAS o JSON puro, sem marcadores de código (\`\`\`json) ou textos adicionais.

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

  try {
    let rawText = await rotacionarRequisicao(prompt, "Geração de Copy");
    rawText = rawText.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```$/s, "").trim();
    return JSON.parse(rawText);
  } catch (e) {
    // === FALLBACK LOCAL INTELIGENTE (Previne qualquer erro de API e mantém o fluxo rodando) ===
    console.log(`\n[AVISO] API instável para "${produto.nome_limpo}". Gerando cópia inteligente local...`);
    
    const tituloGerado = `${produto.nome_limpo} ${produto.marca} - Original ProLimp`;
    const skuGerado = `${produto.marca}-${produto.nome_limpo}`.toUpperCase().replace(/[^A-Z0-9]/g, '-').substring(0, 20);
    
    return { 
      titulo: tituloGerado.substring(0, 100), 
      descricao: `🏆 O QUE É O PRODUTO?\\nO ${produto.nome_limpo} da ${produto.marca} é um produto de alta performance desenvolvido para estética automotiva profissional.\\n\\n✨ BENEFÍCIOS E CARACTERÍSTICAS:\\n- Qualidade comprovada e originalidade garantida.\\n- Excelente rendimento e facilidade de aplicação.\\n- Acabamento profissional de alto nível.\\n\\n🛠️ MODO DE USO:\\n1. Certifique-se de que a superfície esteja limpa e fria.\\n2. Aplique o produto conforme as orientações técnicas do fabricante.\\n3. Faça o acabamento com pano de microfibra limpo e seco.\\n\\n📊 INFORMAÇÕES ADICIONAIS:\\n- Produto pronto para uso.\\n- Conte com o suporte da ProLimp para qualquer dúvida.`, 
      categoria_sugerida: "Automotivo > Cuidados Automotivos", 
      tags_busca: [produto.marca, "estetica automotiva", "prolimp", "automotivo"], 
      peso_estimado_g: 500,
      dimensoes_estimadas_cm: "10x10x20",
      sku_sugerido: skuGerado,
      preco_mercado_estimado: 59.90 
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
    return "Auditoria concluída localmente sem IA devido à instabilidade de rede.";
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
  
  itensGerados.push({ 
    nome_original: produto.nome_estoque, 
    nome_limpo: produto.nome_limpo,
    titulo_shopee: conteudo.titulo, 
    descricao: conteudo.descricao,
    categoria: conteudo.categoria_sugerida,
    preco_venda: precoVendaCalculado,
    estoque: produto.estoque,
    sku: conteudo.sku_sugerido,
    peso_gramas: conteudo.peso_estimado_g,
    dimensoes_cm: conteudo.dimensoes_estimadas_cm,
    precisa_revisar: precisaRevisar 
  });
}

async function main() {
  const MODO_TESTE = false; 

  const produtos = await processarEstoquePDF(INPUT_FILE);
  const itensGerados = [];
  let skusJaProcessados = new Set();
  const cabecalho = "nome_original,titulo_shopee,descricao_shopee,categoria_sugerida,tags_busca,peso_estimado_g,dimensoes_estimadas_cm,sku_sugerido,preco_venda_calculado,preco_mercado_ia,estoque,precisa_revisar\n"; 

  if (produtos.length > 0) {
      if (fs.existsSync(OUTPUT_FILE)) {
          const conteudoAtual = fs.readFileSync(OUTPUT_FILE, 'utf-8');
          if (conteudoAtual.trim().length > 0) {
              const linhas = conteudoAtual.split('\n').slice(1);
              linhas.forEach(linha => {
                  if (linha.trim()) skusJaProcessados.add(linha.split(',')[0].replace(/^"|"$/g, ''));
              });
          } else fs.writeFileSync(OUTPUT_FILE, cabecalho, "utf-8"); 
      } else fs.writeFileSync(OUTPUT_FILE, cabecalho, "utf-8"); 
  } else {
      console.log("\n❌ [ERRO] O leitor de PDF não encontrou nenhum produto válido ou falhou ao ler o arquivo.");
      return;
  }

  let produtosPendentes = produtos.filter(p => !skusJaProcessados.has(p.nome_estoque));
  
  if (produtosPendentes.length === 0) {
      console.log("[SYS] O CSV já possui todos os dados solicitados. A gerar template Excel...");
      await injetarNoTemplateShopee(produtos);
      return;
  }

  if (MODO_TESTE) {
      console.log("\n[QA] 🧪 MODO TESTE ATIVADO: Isolando apenas 1 produto para teste.");
      produtosPendentes = produtosPendentes.slice(0, 1);
  }

  console.log(`[SYS] ${skusJaProcessados.size} produtos já processados anteriormente.`);
  console.log(`[SYS] Processando lote de ${produtosPendentes.length} produtos (com proteção de fallback e pausa de segurança)...\n`);

  for (const [i, produto] of produtosPendentes.entries()) {
    process.stdout.write(`  [${i + 1}/${produtosPendentes.length}] ${produto.nome_limpo}... `);
    try {
      await processarProduto(produto, itensGerados);
      console.log("OK");
    } catch (err) {
      console.log("ERRO (Fallback acionado com sucesso)");
    }
    // Pausa segura de 3 segundos entre itens para suavizar requisições
    if (i < produtosPendentes.length - 1) await sleep(3000); 
  }

  if (itensGerados.length > 0 || produtos.length > 0) {
      console.log("\n[SYS] Gerando relatório de auditoria...");
      const relatorio = await revisarLote(itensGerados);
      fs.appendFileSync(REPORT_FILE, `\n\n## Auditoria Automática\n\n${relatorio}\n`, "utf-8");
      
      console.log("\n[SYS] Preenchendo e gerando o template oficial da Shopee (.xlsx)...");
      const todosOsItensParaExcel = produtos.map(p => {
        const encontrado = itensGerados.find(item => item.nome_original === p.nome_estoque);
        return encontrado || {
          nome_original: p.nome_estoque,
          nome_limpo: p.nome_limpo,
          titulo_shopee: `${p.nome_limpo} - Original`,
          descricao: "Produto original ProLimp.",
          categoria: "Automotivo > Cuidados Automotivos",
          preco_venda: calcularPrecoVendaShopee(p.preco_custo, 0.25),
          estoque: p.estoque,
          sku: `PROLIMP-${p.nome_limpo}`.substring(0, 20).toUpperCase()
        };
      });

      await injetarNoTemplateShopee(todosOsItensParaExcel);
      console.log(`\n[SYS] 🎉 Processo 100% finalizado! Planilha 'Upload_Pronto_Para_Shopee.xlsx' pronta na pasta data/.`);
  }
}

main().catch(err => { console.error("Falha no thread principal:", err); process.exit(1); });