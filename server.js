const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
app.use(cors());

// Trocamos para GET pois o EventSource (SSE) do navegador funciona via GET
app.get('/api/stream-automacao', (req, res) => {
    // 1. Configura os cabeçalhos para manter a conexão aberta em streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); 

    const scriptPath = path.join(__dirname, 'scripts', 'gerar-listagens.js');
    const processo = spawn('node', [scriptPath]);

    // 2. Sempre que o script "cuspir" algo no terminal, enviamos para o React
    processo.stdout.on('data', (data) => {
        res.write(`data: ${JSON.stringify({ texto: data.toString() })}\n\n`);
    });

    processo.stderr.on('data', (data) => {
        res.write(`data: ${JSON.stringify({ texto: data.toString(), erro: true })}\n\n`);
    });

    // 3. Avisa o frontend quando o script terminar
    processo.on('close', (code) => {
        res.write(`data: ${JSON.stringify({ finalizado: true, codigo: code })}\n\n`);
        res.end();
    });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Motor de automação rodando em http://localhost:${PORT}`);
});