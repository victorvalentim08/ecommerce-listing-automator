import { useState, useRef, useEffect } from 'react';

function App() {
  const [logText, setLogText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const terminalRef = useRef<HTMLPreElement>(null);

  // Faz o scroll descer automaticamente conforme novas linhas aparecem
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logText]);

  const dispararAutomacao = () => {
    setLoading(true);
    setLogText('Estabelecendo conexão segura com o motor Node.js...\n\n');
    
    // Abre o túnel (Server-Sent Events) com o backend
    const eventSource = new EventSource('http://localhost:3000/api/stream-automacao');
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.finalizado) {
        setLogText(prev => prev + `\n\n✅ Processo finalizado! (Código: ${data.codigo})\n`);
        setLoading(false);
        eventSource.close(); // Fecha a conexão
      } else if (data.texto) {
        setLogText(prev => prev + data.texto);
      }
    };

    eventSource.onerror = () => {
      setLogText(prev => prev + '\n❌ Erro de conexão com o servidor. O servidor Node está rodando?');
      setLoading(false);
      eventSource.close();
    };
  };

  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', fontFamily: 'system-ui, sans-serif', padding: '20px' }}>
      <h1>Automator Hub 🚀</h1>
      <p style={{ color: '#555', marginBottom: '30px' }}>
        Gerador de listagens e inteligência artificial rodando em tempo real.
      </p>
      
      <button 
        onClick={dispararAutomacao} 
        disabled={loading}
        style={{ 
          padding: '12px 24px', 
          fontSize: '16px', 
          cursor: loading ? 'not-allowed' : 'pointer', 
          backgroundColor: loading ? '#94a3b8' : '#2563eb', 
          color: 'white', 
          border: 'none', 
          borderRadius: '6px',
          fontWeight: 'bold',
          transition: 'background 0.2s',
          marginBottom: '20px'
        }}
      >
        {loading ? 'Processando Lote...' : 'Iniciar Automação com IA'}
      </button>

      {/* Caixa de Terminal Simulada */}
      <div style={{
        backgroundColor: '#1e1e1e',
        borderRadius: '8px',
        padding: '16px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
        marginTop: '10px'
      }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#ff5f56' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#ffbd2e' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#27c93f' }} />
        </div>
        
        <pre 
          ref={terminalRef}
          style={{ 
            color: '#00ff00', 
            fontFamily: 'monospace', 
            fontSize: '14px',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            margin: 0,
            height: '400px',
            overflowY: 'auto'
          }}
        >
          {logText || 'Aguardando inicialização do sistema...'}
        </pre>
      </div>
    </div>
  );
}

export default App;