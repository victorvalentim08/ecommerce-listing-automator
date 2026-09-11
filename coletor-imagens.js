const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const PASTA_BASE = path.join(__dirname, 'imagens-shopee');

if (!fs.existsSync(PASTA_BASE)) {
    fs.mkdirSync(PASTA_BASE);
}

const produtos = JSON.parse(fs.readFileSync('produtos-vonixx.json', 'utf-8'));
async function baixarImagem(url, caminhoArquivo) {
    try {
        const response = await axios.get(url, { 
            responseType: 'arraybuffer', 
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        fs.writeFileSync(caminhoArquivo, response.data);
        return true;
    } catch (erro) {
        return false;
    }
}

async function buscarImagensBing(termoBusca) {
    try {
        // Usando o motor de imagens do Bing como alternativa aberta e resiliente a bots
        const urlBusca = `https://www.bing.com/images/search?q=${encodeURIComponent(termoBusca)}&form=HDRSC2&first=1`;
        const response = await axios.get(urlBusca, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        const $ = cheerio.load(response.data);
        const links = [];

        // O Bing armazena os links diretos das imagens dentro do atributo m (JSON embutido)
        $('.murl').each((i, element) => {
            const imgUrl = $(element).attr('href');
            if (imgUrl && links.length < 4) {
                links.push(imgUrl);
            }
        });

        return links;
    } catch (erro) {
        console.error(`  [X] Erro ao buscar no Bing: ${erro.message}`);
        return [];
    }
}

async function rodarColetorBlindado() {
    console.log('=== INICIANDO MOTOR DE COLETA BLINDADO (BING ENGINE) ===\n');

    let totalBaixadas = 0;

    for (const produto of produtos) {
        const skuFolder = `${produto.marca.toUpperCase()}-${produto.nome_limpo.toUpperCase().replace(/\s+/g, '-')}`;
        const pastaProduto = path.join(PASTA_BASE, skuFolder);

        if (!fs.existsSync(pastaProduto)) {
            fs.mkdirSync(pastaProduto);
        }

        const termoQuery = `${produto.nome_limpo} ${produto.marca} produto oficial`;
        console.log(`🔍 Pesquisando: ${produto.nome_limpo} (${produto.marca})...`);

        const urlsImagens = await buscarImagensBing(termoQuery);

        if (urlsImagens.length > 0) {
            let salvasNoProduto = 0;
            for (let i = 0; i < urlsImagens.length; i++) {
                const caminhoArquivo = path.join(pastaProduto, `${i + 1}.jpg`);
                const sucesso = await baixarImagem(urlsImagens[i], caminhoArquivo);
                if (sucesso) salvasNoProduto++;
            }
            console.log(`  [OK] ${salvasNoProduto} imagem(ns) salva(s) em /${skuFolder}\n`);
            totalBaixadas += salvasNoProduto;
        } else {
            console.log(`  [!] Nenhuma imagem mapeada para este item.\n`);
        }

        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(`=== COLETA CONCLUÍDA! Total de imagens baixadas: ${totalBaixadas} ===`);
}

rodarColetorBlindado();