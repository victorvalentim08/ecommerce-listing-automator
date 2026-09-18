const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const ExcelJS = require('exceljs');

const PASTA_DATA = path.join(__dirname, '../data');
const INPUT_CSV = path.join(PASTA_DATA, 'shopee-produtos.csv');
const TEMPLATE_FILE = path.join(PASTA_DATA, 'template-oficial.xlsx');
const OUTPUT_FILE = path.join(PASTA_DATA, 'Upload_Pronto_Para_Shopee.xlsx');

async function main() {
    console.log('[SYS] Iniciando motor de injeção direta no Template Oficial...');

    if (!fs.existsSync(TEMPLATE_FILE)) {
        console.error('[ERRO] O arquivo "template-oficial.xlsx" não foi encontrado na pasta data.');
        return;
    }

    // 1. Lendo os produtos do nosso CSV
    const produtos = [];
    await new Promise((resolve, reject) => {
        fs.createReadStream(INPUT_CSV)
            .pipe(csv())
            .on('data', (row) => produtos.push(row))
            .on('end', resolve)
            .on('error', reject);
    });

    console.log(`[SYS] ${produtos.length} produtos carregados da base de dados.`);

    // 2. Carregando a planilha oficial sem quebrar as formatações
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(TEMPLATE_FILE);

    // A Shopee sempre usa a aba nomeada "Modelo" para os dados
    const worksheet = workbook.getWorksheet('Modelo');

    if (!worksheet) {
        console.error('[ERRO] A aba "Modelo" não foi encontrada no template da Shopee.');
        return;
    }

    // 3. Injeção Cirúrgica (A Shopee espera os dados a partir da linha 6)
    let linhaAtual = 6;

    for (const p of produtos) {
        const dimensoes = p.dimensoes_estimadas_cm ? p.dimensoes_estimadas_cm.split('x') : ['10', '10', '10'];

        // Mapeamento pelas colunas exatas do Schema da Shopee
        worksheet.getCell(`A${linhaAtual}`).value = ''; // Shopee exige ID Numérico. Deixando vazio, a plataforma auto-sugere pelo título. // Categoria
        worksheet.getCell(`B${linhaAtual}`).value = p.titulo_shopee;      // Nome
        worksheet.getCell(`C${linhaAtual}`).value = p.descricao_shopee;   // Descrição
        worksheet.getCell(`D${linhaAtual}`).value = p.sku_sugerido;       // SKU Principal
        worksheet.getCell(`K${linhaAtual}`).value = parseFloat(p.preco_venda_calculado); // Preço
        worksheet.getCell(`L${linhaAtual}`).value = parseInt(p.estoque);  // Estoque
        worksheet.getCell(`AA${linhaAtual}`).value = parseInt(p.peso_estimado_g); // Peso
        worksheet.getCell(`AB${linhaAtual}`).value = parseInt(dimensoes[0]); // Comprimento
        worksheet.getCell(`AC${linhaAtual}`).value = parseInt(dimensoes[1]); // Largura
        worksheet.getCell(`AD${linhaAtual}`).value = parseInt(dimensoes[2]); // Altura
        worksheet.getCell(`AE${linhaAtual}`).value = 'Ligado'; // Correios (Ativa o Frete)

        linhaAtual++;
    }

    // 4. Salvando o arquivo final
    await workbook.xlsx.writeFile(OUTPUT_FILE);
    console.log(`[SYS] Injeção concluída com sucesso!`);
    console.log(`[SYS] Arquivo blindado gerado: ${OUTPUT_FILE}`);
}

main().catch(err => console.error('[FALHA CRÍTICA]', err));