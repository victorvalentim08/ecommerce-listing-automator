const fs = require('fs');
const pdfParse = require('pdf-parse');

/**
 * Leitor de PDF Avançado para Relatórios ProLimp / Vonixx
 * Extrai e normaliza automaticamente nomes grudados, volumes e preços.
 */
async function processarEstoquePDF(caminhoArquivo) {
    try {
        const dataBuffer = fs.readFileSync(caminhoArquivo);
        const documento = await pdfParse(dataBuffer);
        
        console.log("[SYS] PDF lido com sucesso. Minerando e normalizando produtos...");
        
        const produtos = [];
        const textoCompleto = documento.text || "";

        // Divide o texto fatiando pela palavra 'UN' que sempre separa o produto dos números no layout
        const blocos = textoCompleto.split('UN');

        for (let i = 0; i < blocos.length - 1; i++) {
            let blocoAtual = blocos[i].trim();
            let proximoBloco = blocos[i + 1].trim();

            if (!blocoAtual || !proximoBloco) continue;

            // Limpezas iniciais de cabeçalhos e lixos de impressão
            let nomeBruto = blocoAtual
                .replace(/EstoquedeProdutos.*?:/g, '')
                .replace(/Datadeimpressão.*/g, '')
                .replace(/^[0-9]+\s*PROLIMP/, '')
                .trim();
                
            nomeBruto = nomeBruto.replace(/EstoqueP\.custoCustototalP\.vendaVendatotal/g, '').trim();

            // Isola o início a partir da primeira letra maiúscula válida
            const matchLetra = nomeBruto.search(/[A-ZÀ-Ú]/);
            if (matchLetra > 0) {
                nomeBruto = nomeBruto.substring(matchLetra);
            }

            // === NORMALIZAÇÃO CIRÚRGICA DE NOMES GRUDADOS ===
            // 1. Insere espaço entre letras e unidades de volume (ex: ZUCS500ML -> ZUCS 500ML, EXTRACTUS1,5L -> EXTRACTUS 1,5L)
            nomeBruto = nomeBruto.replace(/([A-ZÀ-Úa-z])(\d+[\.,]?\d*ML|\d+[\.,]?\d*L|\d+G)/gi, '$1 $2');
            
            // 2. Separa marcas coladas no final ou meio (ex: 500MLZACS -> 500ML ZACS)
            nomeBruto = nomeBruto.replace(/(\d+[\.,]?\d*ML|\d+[\.,]?\d*L|\d+G)([A-ZÀ-Ú])/gi, '$1 $2');
            
            // 3. Separa palavras que colaram juntas por falta de espaço no PDF (ex: CeraBrilho -> Cera Brilho)
            nomeBruto = nomeBruto.replace(/([a-zÀ-Ú])([A-ZÀ-Ú])/g, '$1 $2');

            // 4. Garante espaçamento limpo em hífens e pontuações coladas
            nomeBruto = nomeBruto.replace(/\s*-\s*/g, ' - ').replace(/\s+/g, ' ').trim();

            // Extrai o estoque e o preço de custo do próximo bloco logo após 'UN'
            const matchDados = proximoBloco.match(/^(\d{1,3})(\d+,\d{2})/);
            if (!matchDados) continue;

            const estoque = parseInt(matchDados[1], 10);
            const precoCusto = parseFloat(matchDados[2].replace(',', '.'));

            // Validações de integridade comercial
            if (
                nomeBruto && 
                nomeBruto.length > 3 && 
                !nomeBruto.includes('Produto') && 
                !nomeBruto.includes('Grupo') &&
                estoque > 0
            ) {
                // Evita duplicados na extração
                if (!produtos.some(p => p.nome_estoque === nomeBruto)) {
                    produtos.push({
                        nome_estoque: nomeBruto,
                        nome_limpo: nomeBruto,
                        marca: nomeBruto.includes('VONIXX') ? 'Vonixx' : 'Diversos',
                        funcao: 'Estética Automotiva',
                        estoque: estoque,
                        preco_custo: precoCusto
                    });
                }
            }
        }

        console.log(`[SYS] Extração e normalização concluídas. ${produtos.length} produtos limpos encontrados.`);
        return produtos;
        
    } catch (erro) {
        console.error("[ERRO CRÍTICO] Falha ao processar o ficheiro PDF:", erro.message);
        return [];
    }
}

module.exports = { processarEstoquePDF };