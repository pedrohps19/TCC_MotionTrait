import React, { useState, useEffect } from 'react';
import { Line, Bar, Pie } from 'react-chartjs-2';
import { useNavigate } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import axios from 'axios';
import VideoList from './VideoList';
import style from '../styles/dashboard.module.css';

// Registrar componentes do ChartJS
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const Dashboard = () => {
  const navigate = useNavigate();
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [metrics, setMetrics] = useState({
    views: 0,
    likes: 0,
    comments: 0,
    subscribers: 0,
    videos: 0
  });
  const [loading, setLoading] = useState({
    metrics: true,
    analysis: false,
    check: false,
    comments: false
  });
  const [analysisCount, setAnalysisCount] = useState(0);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [engagementData, setEngagementData] = useState(null);
  const [showUpdatesModal, setShowUpdatesModal] = useState(false);
  const [activeTab, setActiveTab] = useState('engagement');
  const [lastAnalysisDate, setLastAnalysisDate] = useState(null);
  const [exporting, setExporting] = useState(false);

  //Abaixo as funções estão com comentários para facilitar o fluxo e entendimento do código

  // Buscar dados iniciais
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const token = localStorage.getItem('token');
        
        // Buscar métricas
        const metricsResponse = await axios.get('/api/metrics', {
          headers: { 'x-access-token': token }
        });
        setMetrics(metricsResponse.data);
        
        // Buscar contagem de análises e data da última análise
        const userResponse = await axios.get('/api/user', {
          headers: { 'x-access-token': token }
        });
        setAnalysisCount(userResponse.data.analysis_count || 0);
        setLastAnalysisDate(userResponse.data.last_analysis);
        
      } catch (err) {
        if (err.response?.status === 401) {
          navigate('/login');
        }
        console.error('Error fetching initial data:', err);
      } finally {
        setLoading(prev => ({ ...prev, metrics: false }));
      }
    };

    fetchInitialData();
  }, [navigate]);

  // Função para análise completa
  const handleFullAnalysis = async () => {
    if (analysisCount >= 5) {
      setShowLimitModal(true);
      return;
    }

    setLoading(prev => ({ ...prev, analysis: true }));
    try {
      const token = localStorage.getItem('token');
      const channel = localStorage.getItem('youtube_channel');
      
      await axios.post('/api/analyze-channel-complete', 
        { channel_name: channel },
        { headers: { 'x-access-token': token } }
      );
      
      // Atualizar contagem e data
      const userResponse = await axios.get('/api/user', {
        headers: { 'x-access-token': token }
      });
      setAnalysisCount(userResponse.data.analysis_count);
      setLastAnalysisDate(userResponse.data.last_analysis);
      
      // Recarregar métricas
      const metricsResponse = await axios.get('/api/metrics', {
        headers: { 'x-access-token': token }
      });
      setMetrics(metricsResponse.data);
      
    } catch (err) {
      console.error('Error in full analysis:', err);
    } finally {
      setLoading(prev => ({ ...prev, analysis: false }));
    }
  };

  // Função para verificar atualizações
  const handleCheckUpdates = async () => {
    setLoading(prev => ({ ...prev, check: true }));
    try {
      const token = localStorage.getItem('token');
      const channel = localStorage.getItem('youtube_channel');
      
      const response = await axios.post('/api/check-channel-updates', 
        { channel_name: channel },
        { headers: { 'x-access-token': token } }
      );
      
      if (response.data.has_updates) {
        setShowUpdatesModal(true);
        
        // Recarregar métricas
        const metricsResponse = await axios.get('/api/metrics', {
          headers: { 'x-access-token': token }
        });
        setMetrics(metricsResponse.data);
      } else {
        alert('Não há novos vídeos desde a última análise.');
      }
      
    } catch (err) {
      console.error('Error checking updates:', err);
      alert('Erro ao verificar atualizações');
    } finally {
      setLoading(prev => ({ ...prev, check: false }));
    }
  };

  // Função para buscar comentários e gerar gráficos
  const fetchComments = async (videoId) => {
    if (!videoId) return;
    
    setLoading(prev => ({ ...prev, comments: true }));
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/videos/${videoId}/analytics`, {
        headers: { 'x-access-token': token }
      });
      
      if (response.data.success) {
        const { engagement, sentiment, performance } = response.data;
        
        // Dados para o gráfico de engajamento
        const engagementData = {
          labels: engagement.labels,
          datasets: engagement.datasets
        };
        
        // Gráfico de performance relativa
        const performanceData = {
          labels: ['Taxa de Curtidas', 'Taxa de Comentários', 'Retenção'],
          datasets: [
            {
              label: 'Este Vídeo',
              data: [
                (performance.current_likes / performance.current_views) * 1000, // likes por 1000 views
                (performance.current_comments / performance.current_views) * 1000, // comentários por 1000 views
                70 // retenção
              ],
              backgroundColor: '#2196F3'
            },
            {
              label: 'Média do Canal',
              data: [
                (metrics.likes / metrics.views) * 1000,
                (metrics.comments / metrics.views) * 1000,
                65 
              ],
              backgroundColor: '#9E9E9E'
            }
          ]
        };
        
        setEngagementData({
          engagement: engagementData,
          performance: performanceData,
          comparison: {
            current_views: performance.current_views,
            current_likes: performance.current_likes,
            current_comments: performance.current_comments,
            avg_views: metrics.views / metrics.videos || 0,
            avg_likes: metrics.likes / metrics.videos || 0,
            avg_comments: metrics.comments / metrics.videos || 0
          }
        });
      }
    } catch (err) {
      console.error('Error fetching comments:', err);
    } finally {
      setLoading(prev => ({ ...prev, comments: false }));
    }
  };

  // Selecionar vídeo
  const handleVideoSelect = (video) => {
    setSelectedVideo(video);
    fetchComments(video.video_id);
  };

  // Formatar data
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleExportAnalysis = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem('token');
      
      // Obter a última análise
      const analysesResponse = await axios.get('/api/analyses', {
        headers: { 'x-access-token': token }
      });
      
      if (analysesResponse.data.analyses.length === 0) {
        alert('Nenhuma análise disponível para exportar');
        return;
      }
      
      const lastAnalysisId = analysesResponse.data.analyses[0].id;
      
      // Fazer a requisição para exportar
      const response = await axios.get(`/api/export-analysis/${lastAnalysisId}`, {
        headers: { 'x-access-token': token },
        responseType: 'blob'
      });
      
      // Criar link para download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      // Extrair o nome do arquivo do cabeçalho Content-Disposition
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'analise_youtube.csv';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1];
        }
      }
      
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
    } catch (err) {
      console.error('Error exporting analysis:', err);
      alert('Erro ao exportar análise');
    } finally {
      setExporting(false);
    }
  };
  return (
    <div className={style.dashboardContainer}>
      {/* Modal de Limite de Análises */}
      {showLimitModal && (
        <div className={style.modalOverlay}>
          <div className={style.modal}>
            <h3>Limite de Análises</h3>
            <p>Você atingiu o limite de 5 análises completas.</p>
            <p>Você ainda pode verificar atualizações para analisar novos vídeos.</p>
            <div className={style.modalButtons}>
              <button 
                className={style.confirmButton}
                onClick={() => setShowLimitModal(false)}
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Atualizações */}
      {showUpdatesModal && (
        <div className={style.modalOverlay}>
          <div className={style.modal}>
            <h3>Atualizações Disponíveis</h3>
            <p>Foram encontrados novos vídeos no seu canal!</p>
            <p>Deseja analisar os novos conteúdos agora?</p>
            <div className={style.modalButtons}>
              <button 
                className={style.confirmButton}
                onClick={() => {
                  setShowUpdatesModal(false);
                  handleFullAnalysis();
                }}
              >
                Analisar Agora
              </button>
              <button 
                className={style.cancelButton}
                onClick={() => setShowUpdatesModal(false)}
              >
                Mais Tarde
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cabeçalho */}
      <div className={style.header}>
        <div>
          <h2 className={style.dashboardTitle}>Dashboard de Análise</h2>
          {lastAnalysisDate && (
            <p className={style.lastAnalysis}>
              Última análise: {formatDate(lastAnalysisDate)}
            </p>
          )}
        </div>

        <button
          className={style.exportButton}
          onClick={handleExportAnalysis}
          disabled={exporting || analysisCount === 0}
        >
          {exporting ? (
            <>
              <span className={style.spinner}></span>
              Exportando...
            </>
          ) : (
            'Exportar Análise'
          )}
        </button>

        <div className={style.analysisControls}>
          <button
            className={style.analyzeButton}
            onClick={handleFullAnalysis}
            disabled={loading.analysis || analysisCount >= 5}
          >
            {loading.analysis ? (
              <>
                <span className={style.spinner}></span>
                Analisando...
              </>
            ) : (
              `Análise Completa (${5 - analysisCount} restantes)`
            )}
          </button>
          <button
            className={style.checkButton}
            onClick={handleCheckUpdates}
            disabled={loading.check}
          >
            {loading.check ? (
              <>
                <span className={style.spinner}></span>
                Verificando...
              </>
            ) : (
              'Verificar Atualizações'
            )}
          </button>
        </div>
      </div>
      
      {/* Métricas Gerais */}
      {loading.metrics ? (
        <div className={style.loading}>Carregando métricas...</div>
      ) : (
        <div className={style.generalMetrics}>
          <div className={style.metricCard}>
            <h3>Inscritos</h3>
            <p className={style.metricValue}>{metrics.subscribers.toLocaleString()}</p>
          </div>
          <div className={style.metricCard}>
            <h3>Vídeos</h3>
            <p className={style.metricValue}>{metrics.videos.toLocaleString()}</p>
          </div>
          <div className={style.metricCard}>
            <h3>Visualizações</h3>
            <p className={style.metricValue}>{metrics.views.toLocaleString()}</p>
          </div>
          <div className={style.metricCard}>
            <h3>Curtidas</h3>
            <p className={style.metricValue}>{metrics.likes.toLocaleString()}</p>
          </div>
          <div className={style.metricCard}>
            <h3>Comentários</h3>
            <p className={style.metricValue}>{metrics.comments.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Conteúdo Principal */}
      <div className={style.contentWrapper}>
        {/* Lista de Vídeos (importando o componente videoList)*/}
        <div className={style.videoListSection}>
          <h3>Últimos Vídeos</h3>
          <VideoList 
            onVideoSelect={handleVideoSelect}
          />
        </div>
        
        {/* Detalhes do Vídeo Selecionado */}
        {selectedVideo && (
          <div className={style.videoDetailsSection}>
            <div className={style.videoHeader}>
              <h3>{selectedVideo.title}</h3>
              <div className={style.videoStats}>
                <div className={style.statItem}>
                  <span>Visualizações</span>
                  <strong>{selectedVideo.views.toLocaleString()}</strong>
                </div>
                <div className={style.statItem}>
                  <span>Curtidas</span>
                  <strong>{selectedVideo.likes.toLocaleString()}</strong>
                </div>
                <div className={style.statItem}>
                  <span>Comentários</span>
                  <strong>{selectedVideo.comments.toLocaleString()}</strong>
                </div>
              </div>
            </div>
            
            {/* Abas dos Gráficos */}
            <div className={style.chartTabs}>
              <button
                className={`${style.tabButton} ${activeTab === 'engagement' ? style.activeTab : ''}`}
                onClick={() => setActiveTab('engagement')}
              >
                Engajamento
              </button>
              <button
                className={`${style.tabButton} ${activeTab === 'performance' ? style.activeTab : ''}`}
                onClick={() => setActiveTab('performance')}
              >
                Performance
              </button>
              <button
                className={`${style.tabButton} ${activeTab === 'comparison' ? style.activeTab : ''}`}
                onClick={() => setActiveTab('comparison')}
              >
                Comparação
              </button>
            </div>
            
            {/* Gráficos */}
            <div className={style.chartContainer}>
              {loading.comments ? (
                <div className={style.loading}>Carregando dados...</div>
              ) : engagementData ? (
                <>
                  {activeTab === 'engagement' && (
                    <div className={style.chartWrapper}>
                      <h4>Histórico de Engajamento</h4>
                      <Line 
                        data={engagementData.engagement} 
                        options={{
                          responsive: true,
                          plugins: { 
                            legend: { position: 'top' },
                            tooltip: {
                              callbacks: {
                                label: (context) => {
                                  let label = context.dataset.label || '';
                                  if (label) label += ': ';
                                  label += context.raw.toLocaleString();
                                  return label;
                                }
                              }
                            }
                          },
                          scales: {
                            y: {
                              ticks: {
                                callback: (value) => value.toLocaleString()
                              }
                            }
                          }
                        }} 
                      />
                    </div>
                  )}
                  
                  {activeTab === 'performance' && (
                    <div className={style.chartWrapper}>
                      <h4>Performance Relativa</h4>
                      <Bar 
                        data={engagementData.performance} 
                        options={{
                          responsive: true,
                          plugins: { 
                            legend: { position: 'top' },
                            tooltip: {
                              callbacks: {
                                label: (context) => {
                                  let label = context.dataset.label || '';
                                  if (label) label += ': ';
                                  label += context.raw.toFixed(2);
                                  if (context.dataIndex < 2) {
                                    label += ' por 1000 views';
                                  } else {
                                    label += '%';
                                  }
                                  return label;
                                }
                              }
                            }
                          },
                          scales: {
                            y: {
                              beginAtZero: true,
                              title: {
                                display: true,
                                text: 'Taxa por 1000 views / % retenção'
                              }
                            }
                          }
                        }}
                      />
                      <div className={style.metricsComparison}>
                        <div className={style.metricComparison}>
                          <h5>Visualizações</h5>
                          <p className={style.videoMetric}>{engagementData.comparison.current_views.toLocaleString()}</p>
                          <p className={style.avgMetric}>Média: {engagementData.comparison.avg_views.toLocaleString()}</p>
                          <p className={engagementData.comparison.current_views >= engagementData.comparison.avg_views ? style.positiveDifference : style.negativeDifference}>
                            {Math.round((engagementData.comparison.current_views / engagementData.comparison.avg_views - 1) * 100)}%
                            {engagementData.comparison.current_views >= engagementData.comparison.avg_views ? '↑' : '↓'}
                          </p>
                        </div>
                        <div className={style.metricComparison}>
                          <h5>Curtidas</h5>
                          <p className={style.videoMetric}>{engagementData.comparison.current_likes.toLocaleString()}</p>
                          <p className={style.avgMetric}>Média: {engagementData.comparison.avg_likes.toLocaleString()}</p>
                          <p className={engagementData.comparison.current_likes >= engagementData.comparison.avg_likes ? style.positiveDifference : style.negativeDifference}>
                            {Math.round((engagementData.comparison.current_likes / engagementData.comparison.avg_likes - 1) * 100)}%
                            {engagementData.comparison.current_likes >= engagementData.comparison.avg_likes ? '↑' : '↓'}
                          </p>
                        </div>
                        <div className={style.metricComparison}>
                          <h5>Comentários</h5>
                          <p className={style.videoMetric}>{engagementData.comparison.current_comments.toLocaleString()}</p>
                          <p className={style.avgMetric}>Média: {engagementData.comparison.avg_comments.toLocaleString()}</p>
                          <p className={engagementData.comparison.current_comments >= engagementData.comparison.avg_comments ? style.positiveDifference : style.negativeDifference}>
                            {Math.round((engagementData.comparison.current_comments / engagementData.comparison.avg_comments - 1) * 100)}%
                            {engagementData.comparison.current_comments >= engagementData.comparison.avg_comments ? '↑' : '↓'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {activeTab === 'comparison' && (
                    <div className={style.chartWrapper}>
                      <h4>Comparação com a Média</h4>
                      <Bar 
                        data={{
                          labels: ['Visualizações', 'Curtidas', 'Comentários'],
                          datasets: [{
                            label: 'Este Vídeo',
                            data: [
                              engagementData.comparison.current_views,
                              engagementData.comparison.current_likes,
                              engagementData.comparison.current_comments
                            ],
                            backgroundColor: '#2196F3'
                          }, {
                            label: 'Média do Canal',
                            data: [
                              engagementData.comparison.avg_views,
                              engagementData.comparison.avg_likes,
                              engagementData.comparison.avg_comments
                            ],
                            backgroundColor: '#9E9E9E'
                          }]
                        }} 
                        options={{
                          responsive: true,
                          plugins: { 
                            legend: { position: 'top' },
                            tooltip: {
                              callbacks: {
                                label: (context) => {
                                  let label = context.dataset.label || '';
                                  if (label) label += ': ';
                                  label += context.raw.toLocaleString();
                                  return label;
                                }
                              }
                            }
                          },
                          scales: {
                            y: {
                              ticks: {
                                callback: (value) => value.toLocaleString()
                              }
                            }
                          }
                        }}
                      />
                    </div>
                  )}
                </>
              ) : (
                <p>Nenhum dado disponível para este vídeo</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;