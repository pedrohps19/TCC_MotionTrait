import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import style from '../styles/videoList.module.css';

const VideoList = ({ onVideoSelect, analysisTimestamp }) => {
  const [videos, setVideos] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedVideoId, setSelectedVideoId] = useState(null);

  const fetchVideos = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/videos', {
        headers: { 'x-access-token': token },
        params: { page: currentPage, per_page: 5 }
      });
      
      setVideos(response.data.videos);
      setTotalPages(response.data.pagination.pages);
      
      // Mantém o vídeo selecionado se ainda estiver na página atual
      if (!response.data.videos.some(v => v.video_id === selectedVideoId)) {
        if (response.data.videos.length > 0 && onVideoSelect) {
          const videoToSelect = response.data.videos[0];
          setSelectedVideoId(videoToSelect.video_id);
          onVideoSelect(videoToSelect);
        }
      }
    } catch (err) {
      console.error('Erro completo:', err);
      setError(err.response?.data?.message || 'Erro ao carregar vídeos');
    } finally {
      setLoading(false);
    }
  }, [currentPage, onVideoSelect, selectedVideoId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchVideos();
    }, 100);

    return () => clearTimeout(timer);
  }, [fetchVideos, analysisTimestamp]);

  const handleVideoSelect = (video) => {
    setSelectedVideoId(video.video_id);
    if (onVideoSelect) {
      onVideoSelect(video);
    }
  };

  if (error) return <div className={style.error}>{error}</div>;
  if (loading && videos.length === 0) return <div className={style.loading}>Carregando vídeos...</div>;

  return (
    <div className={style.videoListContainer}>
      {videos.length === 0 && !loading ? (
        <div className={style.noVideos}>
          Nenhum vídeo encontrado. Por favor, analise seu canal primeiro.
        </div>
      ) : (
        <>
          <div className={style.videoGrid}>
            {videos.map(video => (
              <div 
                key={video.video_id} 
                className={`${style.videoCard} ${selectedVideoId === video.video_id ? style.selected : ''}`}
                onClick={() => handleVideoSelect(video)}
              >
                <img 
                  src={video.thumbnail} 
                  alt={video.title}
                  className={style.videoThumbnail}
                  onError={(e) => {
                    e.target.src = 'https://via.placeholder.com/120x90?text=Thumbnail';
                  }}
                />
                <div className={style.videoInfo}>
                  <h4>{video.title}</h4>
                  <div className={style.videoStats}>
                    <span>👁️ {video.views.toLocaleString()}</span>
                    <span>👍 {video.likes.toLocaleString()}</span>
                    <span>💬 {video.comments.toLocaleString()}</span>
                  </div>
                  <p className={style.videoDate}>
                    {new Date(video.published_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
            ))}
          </div>
          
          {totalPages > 1 && (
            <div className={style.pagination}>
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1 || loading}
              >
                Anterior
              </button>
              <span>Página {currentPage} de {totalPages}</span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages || loading}
              >
                Próxima
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default VideoList;