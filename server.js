const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());

app.get('/api/download', (req, res) => {
    const filePath = path.join(__dirname, 'data', 'Upload_Pronto_Para_Shopee.xlsx');
    if (fs.existsSync(filePath)) {
        res.download(filePath, 'Upload_Pronto_Para_Shopee.xlsx', (err) => {
            if (err) console.error("[ERRO] Falha ao enviar o Excel:", err);
        });
    } else {
        res.status(404).json({ erro: "Ficheiro Excel ainda não gerado." });
    }
});

// Rota para download do CSV/Excel gerado
app.get('/api/download', (req, res) => {
    const filePath = path.join(__dirname, 'data', 'shopee-produtos.csv');
    if (fs.existsSync(filePath)) {
        res.download(filePath, 'shopee-produtos-otimizados.csv', (err) => {
            if (err) {
                console.error("[ERRO] Falha ao descarregar o ficheiro:", err);
            }
        });
    } else {
        res.status(404).json({ erro: "Ficheiro ainda não gerado. Execute o processamento primeiro." });
    }
});

// Configura o Multer para salvar arquivos temporariamente na pasta 'uploads'
const upload = multer({ dest: 'uploads/' });

// ROTA 1: Recebe o arquivo do usuário (PDF, JSON ou Excel)
app.post('/api/upload', upload.single('arquivo'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ sucesso: false, erro: 'Nenhum arquivo enviado.' });
    }
    
    console.log(`[SYS] Arquivo recebido: ${req.file.originalname} -> Salvo como: ${req.file.filename}`);
    
    // Devolvemos o ID do arquivo para o React saber qual arquivo mandar processar
    res.json({ 
        sucesso: true, 
        arquivoId: req.file.filename,
        nomeOriginal: req.file.originalname
    });
});

// ROTA 2: O Motor de IA (Streaming)
app.get('/api/stream-automacao', (req, res) => {
    const arquivoId = req.query.arquivoId;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); 

    if (!arquivoId) {
        res.write(`data: ${JSON.stringify({ texto: '[ERRO] Nenhum arquivo informado para processamento.', erro: true })}\n\n`);
        return res.end();
    }

    const caminhoArquivo = path.join(__dirname, 'uploads', arquivoId);
    const scriptPath = path.join(__dirname, 'scripts', 'gerar-listagens.js');
    
    // Dispara o script passando o caminho exato do arquivo que o usuário fez upload
    const processo = spawn('node', [scriptPath, caminhoArquivo]);

    processo.stdout.on('data', (data) => {
        res.write(`data: ${JSON.stringify({ texto: data.toString() })}\n\n`);
    });

    processo.stderr.on('data', (data) => {
        res.write(`data: ${JSON.stringify({ texto: data.toString(), erro: true })}\n\n`);
    });

    processo.on('close', (code) => {
        res.write(`data: ${JSON.stringify({ finalizado: true, codigo: code })}\n\n`);
        
        // Limpeza de Servidor: Apaga o arquivo temporário após o uso
        if (fs.existsSync(caminhoArquivo)) {
            fs.unlinkSync(caminhoArquivo);
            console.log(`[SYS] Lixo limpo: Arquivo temporário ${arquivoId} deletado.`);
        }
        
        res.end();
    });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Motor de automação rodando em http://localhost:${PORT}`);
});