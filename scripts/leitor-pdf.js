const fs = require('fs');
const pdf = require('pdf-parse');

async function processarEstoquePDF(caminhoArquivo) {
    try {
        const dataBuffer = fs.readFileSync(caminhoArquivo);
        const documento = await pdf(dataBuffer);
        
        console.log("[SYS] PDF lido com sucesso. Minerando produtos...");
        
        const produtos = [];
        const linhas = documento.text.split('\n');

        // Regex para capturar: [NOME] UN [ESTOQUE] [P_CUSTO] [...]
        const regexProduto = /^(.*?)\s+UN\s+(\d+)\s+([\d,]+)/;

        for (const linha of linhas) {
            const linhaLimpa = linha.trim();
            const match = linhaLimpa.match(regexProduto);

            // Ignora o cabeçalho e linhas vazias
            if (match && !linhaLimpa.includes('Produto UN Estoque')) {
                const nomeBruto = match[1].trim();
                const estoque = parseInt(match[2], 10);
                const precoCusto = parseFloat(match[3].replace(',', '.'));

                // Ignora produtos sem estoque para não gastar tokens da IA à toa
                if (estoque > 0) {
                    produtos.push({
                        nome_estoque: nomeBruto,
                        nome_limpo: nomeBruto, // A IA cuida de separar as palavras depois
                        marca: nomeBruto.includes('VONIXX') ? 'Vonixx' : 'Diversos',
                        funcao: 'Estética Automotiva', // Contexto genérico para a IA
                        estoque: estoque,
                        preco_custo: precoCusto
                    });
                }
            }
        }

        console.log(`[SYS] Extração concluída. ${produtos.length} produtos válidos com estoque encontrados.`);
        return produtos;
        
    } catch (erro) {
        console.error("[ERRO] Falha ao ler o ficheiro PDF:", erro.message);
        return [];
    }
}

module.exports = { processarEstoquePDF };