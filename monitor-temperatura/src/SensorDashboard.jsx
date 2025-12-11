// src/SensorDashboard.jsx
import React, { useState, useEffect } from 'react';
import { ref, get } from "firebase/database"; 
import { database } from './firebaseConfig';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import './SensorDashboard.css';

const SensorDashboard = () => {
  const [historico, setHistorico] = useState([]);
  const [analise, setAnalise] = useState({
    temp: { media: 0, status: 'Aguardando...', corStatus: '#999' },
    hum: { media: 0, status: 'Aguardando...', corStatus: '#999' }
  });

  // Função auxiliar de processamento (Média e Status)
  const processarDados = (novoHistorico) => {
    if (novoHistorico.length < 1) return;

    const atual = novoHistorico[novoHistorico.length - 1];
    const anterior = novoHistorico.length > 1 ? novoHistorico[novoHistorico.length - 2] : atual;
    const qtd = novoHistorico.length;

    // --- CÁLCULO TEMPERATURA ---
    const somaTemp = novoHistorico.reduce((acc, curr) => acc + curr.temperatura, 0);
    const mediaTemp = (somaTemp / qtd).toFixed(1);
    
    const diffTemp = atual.temperatura - anterior.temperatura;
    
    let statusTemp = 'Estável';
    let corTemp = '#f1c40f'; // Amarelo

    // Só muda status se variar mais de 5 graus
    if (diffTemp > 5.0) { 
        statusTemp = 'Esquentando Rápido'; 
        corTemp = '#e74c3c'; 
    } else if (diffTemp < -5.0) { 
        statusTemp = 'Resfriando Rápido'; 
        corTemp = '#3498db'; 
    }

    // --- CÁLCULO UMIDADE ---
    const somaHum = novoHistorico.reduce((acc, curr) => acc + curr.umidade, 0);
    const mediaHum = (somaHum / qtd).toFixed(0);

    const diffHum = atual.umidade - anterior.umidade;
    
    let statusHum = 'Estável';
    let corHum = '#f1c40f';

    // Só muda status se variar mais de 5%
    if (diffHum > 5.0) { 
        statusHum = 'Aumentando Rápido'; 
        corHum = '#3498db'; 
    } else if (diffHum < -5.0) { 
        statusHum = 'Diminuindo Rápido'; 
        corHum = '#e67e22'; 
    }

    setAnalise({
      temp: { media: mediaTemp, status: statusTemp, corStatus: corTemp },
      hum: { media: mediaHum, status: statusHum, corStatus: corHum }
    });
  };

  // --- EFEITO PRINCIPAL (Busca e Intervalo) ---
  useEffect(() => {
    // Definimos a função de busca AQUI DENTRO para evitar problemas de escopo
    const fetchData = async () => {
      try {
        // console.log("Buscando dados no Firebase..."); // Descomente para debug
        const sensorRef = ref(database, 'sensores/sala');
        const snapshot = await get(sensorRef);

        if (snapshot.exists()) {
          const data = snapshot.val();
          
          const agora = new Date();
          const horaFormatada = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

          const novaLeitura = {
            hora: horaFormatada,
            temperatura: Number(data.temperatura),
            umidade: Number(data.umidade)
          };

          setHistorico(prev => {
            // Mantém os últimos 10 registros
            const novoArray = [...prev, novaLeitura].slice(-10);
            
            // Chama o processamento usando o array atualizado
            processarDados(novoArray);
            
            return novoArray;
          });
        } else {
          console.log("Nenhum dado encontrado.");
        }
      } catch (error) {
        console.error("Erro ao buscar no Firebase:", error);
      }
    };

    // 1. Chama imediatamente ao carregar
    fetchData();

    // 2. Configura o intervalo de 10 segundos (10000ms)
    const intervalo = setInterval(fetchData, 10000);

    // 3. Limpa o intervalo ao sair da tela
    return () => clearInterval(intervalo);
  }, []);

  const StatusIcon = ({ status }) => {
    if (status.includes('Esquentando') || status.includes('Aumentando')) return <ArrowUp size={20} />;
    if (status.includes('Resfriando') || status.includes('Diminuindo')) return <ArrowDown size={20} />;
    return <Minus size={20} />;
  };

  return (
    <div className="dashboard-wrapper">
      <header>
        <h1>Dashboard</h1>
        <p>Análise de Variação</p>
      </header>

      <div className="main-grid">
        
        {/* Painel Temperatura */}
        <div className="panel temp-panel">
          <div className="panel-header">
            <h2>Temperatura</h2>
            <div className="current-value">
              {historico.length > 0 ? historico[historico.length - 1].temperatura : '--'}°C
            </div>
          </div>
          
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historico}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="hora" tick={{fontSize: 10}} />
                
                {/* Eixo Y fixo 0 a 50 */}
                <YAxis domain={[0, 50]} allowDataOverflow={true} />
                
                <Tooltip />
                <Line isAnimationActive={false} type="monotone" dataKey="temperatura" stroke="#ff6b6b" strokeWidth={3} dot={{r: 4}} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="stats-row">
            <div className="stat-box">
              <span>Média</span>
              <strong>{analise.temp.media}°C</strong>
            </div>
            <div className="stat-box" style={{ color: analise.temp.corStatus, borderColor: analise.temp.corStatus }}>
              <span>Status</span>
              <div className="status-indicator">
                <StatusIcon status={analise.temp.status} />
                <strong>{analise.temp.status}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Painel Umidade */}
        <div className="panel hum-panel">
          <div className="panel-header">
            <h2>Umidade</h2>
            <div className="current-value" style={{color: '#4ecdc4'}}>
              {historico.length > 0 ? historico[historico.length - 1].umidade : '--'}%
            </div>
          </div>

          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historico}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="hora" tick={{fontSize: 10}} />
                
                {/* Eixo Y fixo 0 a 80 */}
                <YAxis domain={[0, 80]} allowDataOverflow={true} />
                
                <Tooltip />
                <Line isAnimationActive={false} type="monotone" dataKey="umidade" stroke="#4ecdc4" strokeWidth={3} dot={{r: 4}} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="stats-row">
            <div className="stat-box">
              <span>Média</span>
              <strong>{analise.hum.media}%</strong>
            </div>
            <div className="stat-box" style={{ color: analise.hum.corStatus, borderColor: analise.hum.corStatus }}>
              <span>Status</span>
              <div className="status-indicator">
                <StatusIcon status={analise.hum.status} />
                <strong>{analise.hum.status}</strong>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SensorDashboard;