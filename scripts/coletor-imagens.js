const fs = require('fs');
const path = require('path');

const PASTA_BASE = path.join(__dirname, 'imagens-shopee');
if (!fs.existsSync(PASTA_BASE)) fs.mkdirSync(PASTA_BASE);

const produtos = JSON.parse(fs.readFileSync('produtos-vonixx.json', 'utf-8'));

console.log('=== PREPARANDO AMBIENTE DA EQUIPE ===\n');

// 1. Estrutura as pastas
produtos.forEach(produto => {
    const skuFolder = `${produto.marca.toUpperCase()}-${produto.nome_limpo.toUpperCase().replace(/\s+/g, '-')}`;
    const pastaProduto = path.join(PASTA_BASE, skuFolder);
    if (!fs.existsSync(pastaProduto)) fs.mkdirSync(pastaProduto);
});
console.log('[OK] Pastas de SKUs criadas com sucesso.');

// 2. Gera o CSV para importação no Excel
// Adicionamos colunas em branco (Preço, Estoque, Código de Barras) para a equipe preencher
const cabecalho = "SKU,Nome do Produto,Marca,Preco,Estoque,Codigo de Barras\n";

const linhasCsv = produtos.map(p => {
    const sku = `${p.marca.toUpperCase()}-${p.nome_limpo.toUpperCase().replace(/\s+/g, '-')}`;
    return `${sku},"${p.nome_limpo}","${p.marca}",,,`;
}).join("\n");

fs.writeFileSync('planilha-prolimp.csv', cabecalho + linhasCsv, 'utf-8');
console.log('[OK] Arquivo planilha-prolimp.csv gerado e pronto para uso!');