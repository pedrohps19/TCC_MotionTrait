import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import style from '../styles/videoCommentsAnalysis.module.css';

const VideoComments = () => {
  const [videos, setVideos] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState({
    videos: false,
    comments: false
  });
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const fetchVideos = async () => {
    setLoading(prev => ({ ...prev, videos: true }));
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/videos', {
        headers: { 
          'x-access-token': token,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data.videos && response.data.videos.length > 0) {
        setVideos(response.data.videos);
        setTotalPages(Math.ceil(response.data.total / 10)); // 10 itens por página
        
        // Seleciona automaticamente o primeiro vídeo se nenhum estiver selecionado
        if (!selectedVideo) {
          handleVideoSelect(response.data.videos[0]);
        }
      } else {
        setVideos([]);
        setComments([]);
      }
    } catch (err) {
      if (err.response?.status === 401) {
        navigate('/login');
      }
      setError(err.response?.data?.message || 'Erro ao carregar vídeo');
    } finally {
      setLoading(prev => ({ ...prev, videos: false }));
    }
  };

  const fetchComments = async (videoId) => {
    if (!videoId) return;
    
    setLoading(prev => ({ ...prev, comments: true }));
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `/api/videos/${videoId}/comments`,
        {
          headers: { 
            'x-access-token': token,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.data.success && response.data.comments) {
        setComments(response.data.comments);
      } else {
        setError(response.data.message || 'Nenhum comentário encontrado');
        setComments([]);
      }
    } catch (err) {
      if (err.response?.status === 401) {
        navigate('/login');
      } else if (err.response?.status === 404) {
        setError('Nenhum comentário disponível para este vídeo');
      } else {
        setError(err.response?.data?.message || 'Erro ao carregar comentarios');
      }
      setComments([]);
    } finally {
      setLoading(prev => ({ ...prev, comments: false }));
    }
  };

  const handleVideoSelect = (video) => {
    setSelectedVideo(video);
    fetchComments(video.video_id);
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  if (error) {
    return (
      <div className={style.error}>
        {error}
        <button onClick={() => setError(null)}>OKAY</button>
      </div>
    );
  }

  return (
    <div className={style.container}>
      <div className={style.videoList}>
        <h2  style={{'color': "white"}}>Videos do Canal</h2>
        
        {loading.videos ? (
          <div className={style.loading}>Carregando vídeos...</div>
        ) : videos.length === 0 ? (
          <div className={style.noVideos}>Nenhum vídeo encontrado</div>
        ) : (
          <>
            <div className={style.videoGrid}>
              {videos.map(video => (
                <div 
                  key={video.video_id} 
                  className={`${style.videoCard} ${selectedVideo?.video_id === video.video_id ? style.selected : ''}`}
                  onClick={() => handleVideoSelect(video)}
                >
                  <img 
                    src={video.thumbnail || 'https://via.placeholder.com/320x180?text=No+Thumbnail'} 
                    alt={video.title} 
                    className={style.thumbnail}
                  />
                  <div className={style.videoInfo}>
                    <h3>{video.title || 'Vídeo sem título'}</h3>
                    <div className={style.videoStats}>
                      <span>👁️ {video.views?.toLocaleString() || '0'}</span>
                      <span>💬 {video.comments?.toLocaleString() || '0'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className={style.pagination}>
                <button
                  onClick={() => {
                    setCurrentPage(p => Math.max(p - 1, 1));
                    fetchVideos();
                  }}
                  disabled={currentPage === 1}
                >
                  ANTERIOR
                </button>
                <span>Page {currentPage} of {totalPages}</span>
                <button
                  onClick={() => {
                    setCurrentPage(p => Math.min(p + 1, totalPages));
                    fetchVideos();
                  }}
                  disabled={currentPage === totalPages}
                >
                  PRÓXIMO
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <div className={style.commentsSection}>
        {selectedVideo ? (
          <>
            <h2>{selectedVideo.title}</h2>
            
            {loading.comments ? (
              <div className={style.loading}>Carregando comentários...</div>
            ) : (
              <div className={style.commentsContainer}>
                <div className={style.commentsHeader}>
                  <h3>Comentários ({comments.length})</h3>
                  <div className={style.commentControls}>
                    <button 
                      onClick={() => fetchComments(selectedVideo.video_id)}
                      className={style.refreshButton}
                    >
                      🔄 Atualizar
                    </button>
                  </div>
                </div>
                
                {comments.length > 0 ? (
                  <ul className={style.commentsList}>
                    {comments.map((comment) => (
                      <li key={comment.id} className={style.comment}>
                        <div className={style.commentHeader}>
                          <span className={style.author}>
                            {comment.author || ''}
                          </span>
                          <span className={style.likes}>
                            ❤️ {comment.likes || 0}
                          </span>
                        </div>
                        <p className={style.commentText}>
                          {comment.text || 'Nenhum comentário disponível'}
                        </p>
                        <div className={style.commentFooter}>
                          <span className={style.date}>
                            {comment.published_at ? 
                              new Date(comment.published_at).toLocaleDateString() : 
                              'No date'}
                          </span>
                          {comment.sentiment && (
                            <span className={`${style.sentimentTag} ${style[comment.sentiment]}`}>
                              {comment.sentiment}
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className={style.noComments}>
                    Nenhum comentário encontrado para este vídeo.
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className={style.noVideoSelected}>
            Selecione um vídeo para ver os comentários
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoComments;