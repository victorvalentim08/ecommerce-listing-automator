const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const xlsx = require('xlsx');

const PASTA_DATA = path.join(__dirname, '../data');
const INPUT_CSV = path.join(PASTA_DATA, 'shopee-produtos.csv');
const OUTPUT_EXCEL = path.join(PASTA_DATA, 'Shopee_Upload_Massa.xlsx');

const produtosMapeados = [];

console.log('[SYS] Iniciando pipeline de Transformação (ETL) com Schema Oficial...');

fs.createReadStream(INPUT_CSV)
  .pipe(csv())
  .on('data', (row) => {
    // Tratamento e limpeza de dimensões
    const dimensoes = row.dimensoes_estimadas_cm ? row.dimensoes_estimadas_cm.split('x') : ['10', '10', '10'];

    // Schema Oficial Shopee (Mapeamento 1:1)
    produtosMapeados.push({
      'Categoria': row.categoria_sugerida,
      'Nome do Produto': row.titulo_shopee,
      'Descrição do Produto': row.descricao_shopee,
      'SKU principal': row.sku_sugerido,
      'Número de Integração de Variação': '',
      'Nome da Variação 1': '',
      'Opção para Variação 1': '',
      'Imagem por Variação': '',
      'Nome da Variação 2': '',
      'Opção para Variação 2': '',
      'Preço': parseFloat(row.preco_venda_calculado) || 0,
      'Estoque': parseInt(row.estoque) || 0,
      'SKU da Variação': '',
      'Template da Tabela de Medidas': '',
      'Imagem de Tamanhos': '',
      'GTIN (EAN)': '',
      'IDs de compatibilidade': '',
      'Imagem de capa': '',
      'Imagem do produto 1': '',
      'Imagem do produto 2': '',
      'Imagem do produto 3': '',
      'Imagem do produto 4': '',
      'Imagem do produto 5': '',
      'Imagem do produto 6': '',
      'Imagem do produto 7': '',
      'Imagem do produto 8': '',
      'Peso': parseInt(row.peso_estimado_g) || 500,
      'Comprimento': parseInt(dimensoes[0]) || 10,
      'Largura': parseInt(dimensoes[1]) || 10,
      'Altura': parseInt(dimensoes[2]) || 10,
      'Correios': 'Ligado', // Padrão de ativação de frete
      'Prazo de Postagem para Encomenda': '',
      'NCM': '',
      'CFOP (Mesmo Estado)': '',
      'CFOP (Outro Estado)': '',
      'Origem': '',
      'CSOSN': '',
      'CEST': '',
      'Unidade de Medida': '',
      'CST PIS/Cofins': '',
      '% total de tributos federais, estaduais e municipais': '',
      'Tipo de Operação': '',
      'EX TIPI (tabela de exceções IPI)': '',
      'Nr. de controle da FCI': '',
      'Nr. RECOPI': '',
      'Informações adicionais do produto': '',
      'Produto é um item agrupável': '',
      'GTIN da Unidade Tributável': '',
      'Quantidade da Unidade Tributável': '',
      'Unidade de medida do item agrupável': '',
      'Motivo da Falha': ''
    });
  })
  .on('end', () => {
    console.log(`[SYS] ${produtosMapeados.length} produtos mapeados sob as regras da plataforma.`);
    
    // Geração do arquivo Excel
    const worksheet = xlsx.utils.json_to_sheet(produtosMapeados);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Upload Direto');

    xlsx.writeFile(workbook, OUTPUT_EXCEL);
    console.log(`[SYS] Arquivo final gerado para upload: ${OUTPUT_EXCEL}`);
  });