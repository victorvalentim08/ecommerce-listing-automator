import { useState, useRef, useEffect } from 'react';

export default function App() {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setArquivo(e.target.files[0]);
    }
  };

  const iniciarProcessamento = async () => {
    if (!arquivo) return;
    
    setIsProcessing(true);
    setLogs(['[SYS] Iniciando upload do ficheiro PDF...']);

    try {
      const formData = new FormData();
      formData.append('arquivo', arquivo);

      const response = await fetch('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!data.sucesso) {
        throw new Error(data.erro || 'Falha no upload');
      }

      setLogs(prev => [...prev, `[SYS] Upload concluído. Ficheiro ID: ${data.arquivoId}`]);
      setLogs(prev => [...prev, '[SYS] Conectando ao motor de IA...']);

      const sse = new EventSource(`http://localhost:3000/api/stream-automacao?arquivoId=${data.arquivoId}`);

      sse.onmessage = (event) => {
        const payload = JSON.parse(event.data);

        if (payload.finalizado) {
          sse.close();
          setIsProcessing(false);
          setLogs(prev => [...prev, `\n✅ Processo finalizado (Código ${payload.codigo}). Planilha Pronta!`]);
          return;
        }

        if (payload.texto) {
          const textoLimpo = payload.texto.replace(/\n$/, '');
          setLogs(prev => [...prev, textoLimpo]);
        }
      };

      sse.onerror = () => {
        sse.close();
        setIsProcessing(false);
        setLogs(prev => [...prev, '\n❌ [ERRO] Conexão com o servidor perdida.']);
      };

    } catch (error: any) {
      setIsProcessing(false);
      setLogs(prev => [...prev, `\n❌ [ERRO] ${error.message}`]);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col font-sans text-slate-100 selection:bg-blue-500/30">
      
      {/* Top Navigation Bar */}
      <nav className="bg-slate-950 text-white shadow-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-lg shadow-sm">
              P
            </div>
            <span className="text-xl font-bold tracking-tight">
              ProLimp <span className="text-blue-500 font-medium">Automator</span>
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <span className="bg-slate-800 border border-slate-700 text-slate-300 text-xs px-3 py-1.5 rounded-full font-medium tracking-wide shadow-inner">
              MÓDULO SHOPEE
            </span>
            <div className="w-8 h-8 rounded-full bg-slate-800 border-2 border-slate-600"></div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Gerador de Anúncios</h1>
          <p className="text-slate-400 mt-2 text-lg">Converta o seu PDF de estoque em anúncios otimizados para a Shopee usando IA.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Coluna Esquerda: Controles */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-slate-800 rounded-2xl shadow-xl border border-slate-700 p-6 flex flex-col h-full">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Entrada de Dados
                </h2>
              </div>
              
              <div className="flex-1 flex flex-col justify-center">
                <input 
                  type="file" 
                  accept=".pdf,.json,.csv"
                  onChange={handleFileChange}
                  className="hidden" 
                  id="file-upload" 
                  disabled={isProcessing}
                />
                <label 
                  htmlFor="file-upload" 
                  className={`group relative flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-xl transition-all duration-200
                    ${isProcessing 
                      ? 'border-slate-700 bg-slate-800/50 opacity-60 cursor-not-allowed' 
                      : 'border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-400 cursor-pointer shadow-inner'
                    }`}
                >
                  <div className="absolute inset-0 bg-blue-400/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  
                  <div className="bg-slate-900 p-3 rounded-full shadow-md border border-slate-700 mb-3 group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  </div>
                  
                  <span className="text-sm font-semibold text-slate-300 text-center px-4">
                    {arquivo ? arquivo.name : "Clique ou arraste o ficheiro PDF"}
                  </span>
                  {!arquivo && (
                    <span className="text-xs text-slate-500 mt-2">Suporta PDF do sistema de estoque</span>
                  )}
                </label>
              </div>

              <button 
                onClick={iniciarProcessamento} 
                disabled={!arquivo || isProcessing}
                className={`w-full mt-6 py-3.5 px-4 rounded-xl font-bold transition-all duration-200 shadow-md flex justify-center items-center gap-2
                  ${!arquivo || isProcessing 
                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed shadow-none' 
                    : 'bg-blue-600 text-white hover:bg-blue-500 hover:shadow-blue-900/20 active:scale-[0.98]'
                  }`}
              >
                {isProcessing ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processando IA...
                  </>
                ) : 'Iniciar Automação'}
              </button>
            </div>
          </div>

          {/* Coluna Direita: Terminal */}
          <div className="lg:col-span-8">
            <div className="bg-slate-800 p-2 rounded-2xl shadow-xl border border-slate-700">
              <div className="bg-[#0d1117] rounded-xl overflow-hidden flex flex-col h-[550px] border border-slate-900 shadow-inner">
                
                {/* Header do Terminal */}
                <div className="bg-[#161b22] px-4 py-3 flex items-center justify-between border-b border-gray-800/80">
                  <div className="flex items-center space-x-2">
                    <div className="flex space-x-1.5">
                      <div className="w-3 h-3 rounded-full bg-[#ff5f56] opacity-80"></div>
                      <div className="w-3 h-3 rounded-full bg-[#ffbd2e] opacity-80"></div>
                      <div className="w-3 h-3 rounded-full bg-[#27c93f] opacity-80"></div>
                    </div>
                    <span className="text-xs text-gray-400 ml-4 font-mono">prolimp-worker.sh</span>
                  </div>
                  <span className="text-[10px] text-gray-600 font-mono uppercase tracking-widest">Motor V2.0</span>
                </div>
                
                {/* Corpo do Terminal */}
                <div 
                  ref={terminalRef}
                  className="p-5 flex-1 overflow-y-auto font-mono text-[13px] leading-relaxed space-y-1 text-[#39ff14]"
                >
                  {logs.length === 0 ? (
                    <div className="text-gray-600 flex flex-col items-center justify-center h-full space-y-4 opacity-50">
                      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>Aguardando instruções...</span>
                    </div>
                  ) : (
                    logs.map((log, index) => {
                      const isError = log.includes('[ERRO]') || log.includes('❌');
                      const isSys = log.includes('[SYS]');
                      const isSuccess = log.includes('✅');
                      
                      let colorClass = 'text-[#39ff14]';
                      if (isError) colorClass = 'text-[#ff5f56] font-bold';
                      if (isSys) colorClass = 'text-[#58a6ff]';
                      if (isSuccess) colorClass = 'text-[#27c93f] font-bold';

                      return (
                        <span key={index} className={`block break-words ${colorClass}`}>
                          {log}
                        </span>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
          
        </div>
      </main>
    </div>
  );
}