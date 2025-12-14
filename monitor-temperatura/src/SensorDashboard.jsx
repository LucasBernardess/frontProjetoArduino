// src/SensorDashboard.jsx
import React, { useState, useEffect, useRef } from 'react'; // Adicionado useRef
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

  // --- NOVO: Referência para controlar o intervalo de envio de e-mails ---
  const ultimoEnvio = useRef(0); 

  // --- NOVO: Função de Envio de Alerta ---
  const enviarAlertaEmail = (temperaturaAtual) => {
    const EMAIL_DESTINO = "xxlucas0404xx@gmail.com";
    const TEMPO_COOLDOWN = 15 * 60 * 1000; // 15 minutos em milissegundos
    const agora = Date.now();

    // Verifica se já passou o tempo de espera desde o último envio
    if (agora - ultimoEnvio.current < TEMPO_COOLDOWN) {
        console.log("Alerta ignorado: E-mail recente já enviado.");
        return;
    }

    // Dados para o FormSubmit
    const dadosAlerta = {
        _subject: `ALERTA CRÍTICO: Temperatura ${temperaturaAtual}°C`,
        _captcha: "false",
        _template: "table",
        mensagem: `Atenção! A temperatura da sala atingiu ${temperaturaAtual}°C. Verifique os equipamentos imediatamente.`,
        data_hora: new Date().toLocaleString('pt-BR')
    };

    console.log("Enviando e-mail de alerta...");

    fetch(`https://formsubmit.co/ajax/${EMAIL_DESTINO}`, {
        method: "POST",
        headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify(dadosAlerta)
    })
    .then(response => response.json())
    .then(data => {
        console.log("E-mail enviado com sucesso!", data);
        ultimoEnvio.current = Date.now(); // Atualiza o horário do último envio
    })
    .catch(error => console.error("Erro ao enviar e-mail:", error));
  };

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
    const fetchData = async () => {
      try {
        const sensorRef = ref(database, 'sensores/sala');
        const snapshot = await get(sensorRef);

        if (snapshot.exists()) {
          const data = snapshot.val();
          
          const agora = new Date();
          const horaFormatada = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

          const tempNum = Number(data.temperatura);
          
          const novaLeitura = {
            hora: horaFormatada,
            temperatura: tempNum,
            umidade: Number(data.umidade)
          };

          // --- NOVO: Checagem de Alerta ---
          if (tempNum > 35) {
             enviarAlertaEmail(tempNum);
          }
          // --------------------------------

          setHistorico(prev => {
            const novoArray = [...prev, novaLeitura].slice(-10);
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

    fetchData();
    const intervalo = setInterval(fetchData, 10000);
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