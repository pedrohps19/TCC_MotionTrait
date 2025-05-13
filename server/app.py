import smtplib
import random
import re
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from dotenv import load_dotenv
import os
import jwt
from functools import wraps
import googleapiclient.discovery
from googleapiclient.errors import HttpError
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
import matplotlib.pyplot as plt
import seaborn as sns
from io import BytesIO
import base64
import time
from datetime import datetime, timedelta
from sqlalchemy import func, exc, or_, and_
from urllib.parse import unquote
import matplotlib
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment
from openpyxl.utils import get_column_letter
from io import BytesIO
from flask import send_file

matplotlib.use('Agg')
from datetime import datetime, timezone

# Carrega as variaveis de ambiente
load_dotenv()


logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('youtube_analysis.log'),
        logging.StreamHandler()
    ]
)

app = Flask(__name__)

# Configuração CORS
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:5173"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "x-access-token"],
        "supports_credentials": True
    }
})

@app.before_request
def handle_options():
    if request.method == 'OPTIONS':
        return {}, 200

# Configuração DataBase do Banco
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'default-secret-key')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_DATABASE_URI'] = f"mysql+pymysql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}@{os.getenv('DB_HOST')}:3306/{os.getenv('DB_NAME')}"


db = SQLAlchemy(app)
bcrypt = Bcrypt(app)

# Database (as tabelas são criadas automaticamente no banco caso não exita)
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False, index=True)
    password = db.Column(db.String(100), nullable=False)
    youtube_channel = db.Column(db.String(100))
    verification_code = db.Column(db.Integer)
    token_expiration = db.Column(db.DateTime)
    last_analysis = db.Column(db.DateTime)
    analysis_count = db.Column(db.Integer, default=0)

    def __repr__(self):
        return f'<User {self.email}>'

class Analysis(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    channel_id = db.Column(db.String(100), nullable=False)
    channel_name = db.Column(db.String(100), nullable=False)
    analysis_date = db.Column(db.DateTime, default=datetime.utcnow)
    subscriber_count = db.Column(db.Integer)
    video_count = db.Column(db.Integer)
    total_views = db.Column(db.Integer)
    total_comments = db.Column(db.Integer)
    positive_comments = db.Column(db.Integer)
    neutral_comments = db.Column(db.Integer)
    negative_comments = db.Column(db.Integer)
    sentiment_pie_chart = db.Column(db.Text)
    sentiment_bar_chart = db.Column(db.Text)
    engagement_chart = db.Column(db.Text)
    user = db.relationship('User', backref='analyses')

class VideoAnalysis(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    analysis_id = db.Column(db.Integer, db.ForeignKey('analysis.id'), nullable=False)
    video_id = db.Column(db.String(100), nullable=False)
    title = db.Column(db.String(255))
    views = db.Column(db.Integer)
    likes = db.Column(db.Integer)
    comments = db.Column(db.Integer)
    published_at = db.Column(db.DateTime)
    analysis = db.relationship('Analysis', backref='videos')

class CommentAnalysis(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    analysis_id = db.Column(db.Integer, db.ForeignKey('analysis.id'), nullable=False)
    video_id = db.Column(db.String(100))
    author = db.Column(db.String(100))
    text = db.Column(db.Text)
    likes = db.Column(db.Integer)
    sentiment = db.Column(db.String(20))
    published_at = db.Column(db.DateTime)
    analysis = db.relationship('Analysis', backref='comments')

class VideoCache(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    channel_id = db.Column(db.String(100), nullable=False)
    video_id = db.Column(db.String(100), nullable=False)
    last_updated = db.Column(db.DateTime, default=datetime.utcnow)
    analysis_data = db.Column(db.JSON) 
    user = db.relationship('User', backref='video_cache')

# YouTube API Configuração
API_SERVICE_NAME = "youtube"
API_VERSION = "v3"
DEVELOPER_KEYS = [
    os.getenv('YOUTUBE_API_KEY_1'),
    os.getenv('YOUTUBE_API_KEY_2'),
    os.getenv('YOUTUBE_API_KEY_3')
]
current_key_index = 0

class YouTubeAnalyzer:
    def __init__(self):
        self.analyzer = SentimentIntensityAnalyzer()
    
    def get_youtube_service(self):
        global current_key_index
        key = DEVELOPER_KEYS[current_key_index]
        current_key_index = (current_key_index + 1) % len(DEVELOPER_KEYS)
        logging.info(f"Using API key: {key[:5]}...{key[-5:]}")
        return googleapiclient.discovery.build(
            API_SERVICE_NAME, 
            API_VERSION, 
            developerKey=key,
            cache_discovery=False
        )
    
    def get_channel_info(self, channel_name):
        youtube = self.get_youtube_service()
        try:
            search_query = channel_name.replace(' ', '+')
            logging.info(f"Searching for channel: {channel_name}")
            
            search_response = youtube.search().list(
                q=search_query,
                part="snippet",
                type="channel",
                maxResults=1
            ).execute()
            
            if not search_response.get('items'):
                logging.error(f"No channel found for query: {search_query}")
                return None
                
            channel = search_response['items'][0]
            channel_id = channel['id']['channelId']
            
            channels_response = youtube.channels().list(
                id=channel_id,
                part="snippet,statistics"
            ).execute()
            
            channel_data = channels_response['items'][0]
            return {
                'id': channel_id,
                'title': channel_data['snippet']['title'],
                'subscribers': int(channel_data['statistics']['subscriberCount']),
                'video_count': int(channel_data['statistics']['videoCount']),
                'thumbnail': channel_data['snippet']['thumbnails']['high']['url'],
                'created_at': channel_data['snippet']['publishedAt'],
                'description': channel_data['snippet'].get('description', '')
            }
            
        except Exception as e:
            logging.error(f"Error getting channel info: {str(e)}")
            return None

    def get_all_videos(self, channel_id):
        youtube = self.get_youtube_service()
        videos = []
        next_page_token = None
        
        try:
            while True:
                search_response = youtube.search().list(
                    channelId=channel_id,
                    part="id",
                    maxResults=50,
                    order="date",
                    pageToken=next_page_token,
                    type="video"
                ).execute()
                
                video_ids = [item['id']['videoId'] for item in search_response.get('items', [])]
                
                if video_ids:
                    videos_response = youtube.videos().list(
                        id=",".join(video_ids),
                        part="snippet,statistics"
                    ).execute()
                    
                    for video in videos_response.get('items', []):
                        videos.append({
                            'id': video['id'],
                            'title': video['snippet']['title'],
                            'views': int(video['statistics'].get('viewCount', 0)),
                            'likes': int(video['statistics'].get('likeCount', 0)),
                            'comments': int(video['statistics'].get('commentCount', 0)),
                            'published_at': video['snippet']['publishedAt'],
                            'thumbnail': video['snippet']['thumbnails']['high']['url'],
                            'description': video['snippet'].get('description', '')
                        })
                
                next_page_token = search_response.get('nextPageToken')
                if not next_page_token:
                    break
                    
                time.sleep(1)
            
            return videos
            
        except Exception as e:
            logging.error(f"Error getting all videos: {str(e)}")
            return None

    def get_new_videos_only(self, channel_id, user_id, max_videos=100):
        """Obtém apenas vídeos novos desde a última análise"""
        # Verifica se já existe cache para este canal
        cached_videos = VideoCache.query.filter_by(
            user_id=user_id,
            channel_id=channel_id
        ).order_by(VideoCache.last_updated.desc()).all()
        
        youtube = self.get_youtube_service()
        videos = []
        next_page_token = None
        new_videos = []
        
        try:
            # Busca os vídeos mais recentes
            while len(videos) < max_videos:
                search_response = youtube.search().list(
                    channelId=channel_id,
                    part="id",
                    maxResults=50,
                    order="date",
                    pageToken=next_page_token,
                    type="video"
                ).execute()
                
                video_ids = [item['id']['videoId'] for item in search_response.get('items', [])]
                
                if not video_ids:
                    break
                    
                # Verifica quais vídeos já estão no cache
                existing_videos = {v.video_id for v in cached_videos}
                new_video_ids = [vid for vid in video_ids if vid not in existing_videos]
                
                if new_video_ids:
                    # Busca detalhes apenas dos vídeos novos
                    videos_response = youtube.videos().list(
                        id=",".join(new_video_ids),
                        part="snippet,statistics"
                    ).execute()
                    
                    for video in videos_response.get('items', []):
                        video_data = {
                            'id': video['id'],
                            'title': video['snippet']['title'],
                            'views': int(video['statistics'].get('viewCount', 0)),
                            'likes': int(video['statistics'].get('likeCount', 0)),
                            'comments': int(video['statistics'].get('commentCount', 0)),
                            'published_at': video['snippet']['publishedAt'],
                            'thumbnail': video['snippet']['thumbnails']['high']['url'],
                            'description': video['snippet'].get('description', '')
                        }
                        new_videos.append(video_data)
                        videos.append(video_data)
                
                next_page_token = search_response.get('nextPageToken')
                if not next_page_token or len(videos) >= max_videos:
                    break
                    
                time.sleep(1)
            
            # Se não há vídeos novos, retorna os mais recentes do cache
            if not new_videos and cached_videos:
                cached_videos = cached_videos[:max_videos]
                return [{
                    'id': v.video_id,
                    **v.analysis_data
                } for v in cached_videos], []
            
            # Combina novos vídeos com cache existente (mantendo limite de max_videos)
            combined_videos = new_videos + [{
                'id': v.video_id,
                **v.analysis_data
            } for v in cached_videos]
            
            return combined_videos[:max_videos], new_videos
            
        except Exception as e:
            logging.error(f"Error getting new videos: {str(e)}")
            return None, None

    def get_all_comments(self, video_id):
        youtube = self.get_youtube_service()
        comments = []
        next_page_token = None
        
        try:
            video_response = youtube.videos().list(
                part="statistics,status",
                id=video_id
            ).execute()
            
            if not video_response.get('items'):
                return None
                
            video_data = video_response['items'][0]
            if 'commentCount' not in video_data['statistics'] or int(video_data['statistics']['commentCount']) == 0:
                return None
                
            if not video_data['status'].get('embeddable', False):
                return None

            while True:
                try:
                    comments_response = youtube.commentThreads().list(
                        videoId=video_id,
                        part="snippet",
                        maxResults=100,
                        pageToken=next_page_token,
                        textFormat="plainText"
                    ).execute()
                except HttpError as e:
                    if "commentsDisabled" in str(e):
                        return None
                    raise

                items = comments_response.get('items', [])
                
                for item in items:
                    comment = item['snippet']['topLevelComment']['snippet']
                    comments.append({
                        'id': item['id'],
                        'video_id': video_id,
                        'author': comment['authorDisplayName'],
                        'text': comment['textDisplay'],
                        'likes': int(comment['likeCount']),
                        'published_at': comment['publishedAt'],
                        'sentiment': self.analyze_sentiment(comment['textDisplay'])
                    })

                next_page_token = comments_response.get('nextPageToken')
                if not next_page_token:
                    break
                    
                time.sleep(1.2)
            
            return comments

        except Exception as e:
            logging.error(f"Error getting all comments: {str(e)}")
            return None

    def analyze_sentiment(self, text):
        scores = self.analyzer.polarity_scores(text)
        if scores['compound'] >= 0.05:
            return 'positive'
        elif scores['compound'] <= -0.05:
            return 'negative'
        else:
            return 'neutral'
    
    def generate_charts(self, comments):
        sentiment_counts = {
            'positive': 0,
            'neutral': 0,
            'negative': 0
        }
    
        for comment in comments:
            sentiment_counts[comment['sentiment']] += 1
        
        fig, ax = plt.subplots(figsize=(10, 5))
        ax.pie(
            sentiment_counts.values(),
            labels=sentiment_counts.keys(),
            autopct='%1.1f%%',
            startangle=140,
            colors=['#4CAF50', '#FFC107', '#F44336']
        )
        ax.set_title('Comment Sentiment Distribution')
        pie_buffer = BytesIO()
        plt.savefig(pie_buffer, format='png')
        pie_buffer.seek(0)
        pie_chart = base64.b64encode(pie_buffer.getvalue()).decode('utf-8')
        plt.close(fig)
    
        fig, ax = plt.subplots(figsize=(10, 5))
        sns.barplot(
            x=list(sentiment_counts.keys()),
            y=list(sentiment_counts.values()),
            hue=list(sentiment_counts.keys()),
            palette=['#4CAF50', '#FFC107', '#F44336'],
            legend=False
        )
        ax.set_title('Comment Sentiment Analysis')
        ax.set_xlabel('Sentiment')
        ax.set_ylabel('Count')
        bar_buffer = BytesIO()
        plt.savefig(bar_buffer, format='png')
        bar_buffer.seek(0)
        bar_chart = base64.b64encode(bar_buffer.getvalue()).decode('utf-8')
        plt.close(fig)
        
        return pie_chart, bar_chart, sentiment_counts
    
    def analyze_channel_complete(self, channel_name):
        start_time = datetime.now()
        
        channel_info = self.get_channel_info(channel_name)
        if not channel_info:
            return None
            
        videos = self.get_all_videos(channel_info['id'])
        if not videos:
            return None
            
        all_comments = []
        for video in videos:
            comments = self.get_all_comments(video['id'])
            if comments:
                all_comments.extend(comments)
            time.sleep(1)
        
        pie_chart, bar_chart, sentiment_stats = self.generate_charts(all_comments)
        
        return {
            'channel_info': channel_info,
            'videos': {
                'count': len(videos),
                'all_videos': videos,
            },
            'comments': {
                'count': len(all_comments),
                'all_comments': all_comments,
            },
            'sentiment_analysis': {
                'pie_chart': pie_chart,
                'bar_chart': bar_chart,
                'stats': sentiment_stats
            },
            'execution_time': str(datetime.now() - start_time)
        }

# JWT Token
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('x-access-token')
        if not token:
            return jsonify({'message': 'Token missing!'}), 401
            
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = db.session.get(User, data['user_id'])
            if not current_user:
                raise ValueError("User not found")
        except Exception as e:
            logging.error(f"Token verification error: {str(e)}")
            return jsonify({'message': 'Invalid token!'}), 401
            
        return f(current_user, *args, **kwargs)
    return decorated

# Serviço de Email automatizado
def send_email(to_email, verification_code):
    from_email = os.getenv('EMAIL_USER')
    password = os.getenv('EMAIL_PASSWORD')
    
    try:
        msg = MIMEMultipart()
        msg['From'] = from_email
        msg['To'] = to_email
        msg['Subject'] = "Your Verification Code"
        
        body = f"""
        <h2>Verification Code</h2>
        <p>Your code is: <strong>{verification_code}</strong></p>
        <p>Expires in 15 minutes.</p>
        """
        
        msg.attach(MIMEText(body, 'html'))
        
        with smtplib.SMTP('smtp.gmail.com', 587) as server:
            server.starttls()
            server.login(from_email, password)
            server.send_message(msg)
            
        logging.info(f"Email sent to {to_email}")
        return True
        
    except Exception as e:
        logging.error(f"Error sending email: {str(e)}")
        return False

# Rotas API
@app.route('/api/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        logging.info(f"Registration attempt: {data.get('email')}")

        # Validação
        required_fields = ['name', 'email', 'youtube_channel', 'password']
        if missing := [f for f in required_fields if f not in data]:
            return jsonify({
                'message': 'Missing required fields',
                'missing_fields': missing
            }), 400

        # Normalização
        email = data['email'].strip().lower()
        name = data['name'].strip()
        youtube_channel = data['youtube_channel'].strip()

        if not re.match(r"^[\w\.-]+@[\w\.-]+\.\w+$", email):
            return jsonify({
                'message': 'Invalid email format',
                'errors': {'email': 'Invalid email'}
            }), 400

        if len(data['password']) < 6:
            return jsonify({
                'message': 'Password too short',
                'errors': {'password': 'Minimum 6 characters'}
            }), 400

        # Check para ver se o email existe
        if User.query.filter(func.lower(User.email) == func.lower(email)).first():
            return jsonify({
                'message': 'Email already registered',
                'errors': {'email': 'Email already in use'}
            }), 409

        hashed_pw = bcrypt.generate_password_hash(data['password']).decode('utf-8')
        
        new_user = User(
            name=name,
            email=email,
            password=hashed_pw,
            youtube_channel=youtube_channel
        )

        db.session.add(new_user)
        db.session.commit()

        token = jwt.encode(
            {'user_id': new_user.id, 'exp': datetime.now(timezone.utc) + timedelta(hours=24)},
            app.config['SECRET_KEY']
        )

        return jsonify({
            'message': 'Registration successful',
            'token': token,
            'user': {
                'id': new_user.id,
                'name': new_user.name,
                'email': new_user.email,
                'youtube_channel': new_user.youtube_channel
            }
        }), 201

    except exc.IntegrityError:
        db.session.rollback()
        return jsonify({
            'message': 'Duplicate entry',
            'error': 'Email already registered'
        }), 409
        
    except Exception as e:
        db.session.rollback()
        logging.error(f"Registration error: {str(e)}", exc_info=True)
        return jsonify({
            'message': 'Internal server error',
            'error': str(e)
        }), 500
    
@app.route('/api/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        logging.info(f"Login attempt for email: {data.get('email')}")
        
        if not data.get('email') or not data.get('password'):
            return jsonify({'message': 'Email and password are required'}), 400
            
        user = User.query.filter_by(email=data['email']).first()
        if not user or not bcrypt.check_password_hash(user.password, data['password']):
            return jsonify({'message': 'Invalid credentials'}), 401
            
        token = jwt.encode(
            {'user_id': user.id, 'exp': datetime.utcnow() + timedelta(hours=24)},
            app.config['SECRET_KEY']
        )
        
        logging.info(f"User logged in successfully: {data['email']}")
        return jsonify({
            'message': 'Login successful',
            'token': token,
            'user': {
                'id': user.id,
                'name': user.name,
                'email': user.email,
                'youtube_channel': user.youtube_channel
            }
        }), 200
        
    except Exception as e:
        logging.error(f"Login error: {str(e)}", exc_info=True)
        return jsonify({'message': 'Login failed', 'error': str(e)}), 500

@app.route('/api/send-verification', methods=['POST'])
def send_verification():
    try:
        data = request.get_json()
        email = data.get('email')
        logging.info(f"Verification code requested for: {email}")
        
        if not email:
            return jsonify({'message': 'Email is required'}), 400
            
        user = User.query.filter_by(email=email).first()
        if not user:
            return jsonify({'message': 'Email not found'}), 404
            
        code = random.randint(100000, 999999)
        user.verification_code = code
        user.token_expiration = datetime.utcnow() + timedelta(minutes=15)
        db.session.commit()
        
        if not send_email(email, code):
            return jsonify({'message': 'Failed to send verification email'}), 500
            
        return jsonify({'message': 'Verification code sent'}), 200
        
    except Exception as e:
        logging.error(f"Verification error: {str(e)}", exc_info=True)
        return jsonify({'message': 'Failed to send verification', 'error': str(e)}), 500

@app.route('/api/verify-code', methods=['POST'])
def verify_code():
    try:
        data = request.get_json()
        email = data.get('email')
        code = data.get('code')
        logging.info(f"Verification attempt for: {email}")
        
        if not email or not code:
            return jsonify({'message': 'Email and code are required'}), 400
            
        user = User.query.filter_by(email=email).first()
        if not user:
            return jsonify({'message': 'Email not found'}), 404
            
        if user.verification_code != int(code):
            return jsonify({'message': 'Invalid code'}), 401
            
        if user.token_expiration < datetime.utcnow():
            return jsonify({'message': 'Code expired'}), 401
            
        return jsonify({'message': 'Code verified successfully'}), 200
        
    except Exception as e:
        logging.error(f"Code verification error: {str(e)}", exc_info=True)
        return jsonify({'message': 'Verification failed', 'error': str(e)}), 500

@app.route('/api/reset-password', methods=['POST'])
def reset_password():
    try:
        data = request.get_json()
        email = data.get('email')
        new_password = data.get('new_password')
        logging.info(f"Password reset requested for: {email}")
        
        if not email or not new_password:
            return jsonify({'message': 'Email and new password are required'}), 400
            
        user = User.query.filter_by(email=email).first()
        if not user:
            return jsonify({'message': 'Email not found'}), 404
            
        user.password = bcrypt.generate_password_hash(new_password).decode('utf-8')
        user.verification_code = None
        user.token_expiration = None
        db.session.commit()
        
        return jsonify({'message': 'Password updated successfully'}), 200
        
    except Exception as e:
        logging.error(f"Password reset error: {str(e)}", exc_info=True)
        return jsonify({'message': 'Password reset failed', 'error': str(e)}), 500

@app.route('/api/analyze-channel-complete', methods=['POST'])
@token_required
def analyze_channel_complete(current_user):
    try:
        data = request.get_json()
        channel_name = unquote(data.get('channel_name', current_user.youtube_channel)).strip()
        
        logging.info(f"Starting optimized analysis for channel: {channel_name}")
        
        analyzer = YouTubeAnalyzer()
        channel_info = analyzer.get_channel_info(channel_name)
        if not channel_info:
            return jsonify({'message': 'Channel not found'}), 404
            
        # Verifica se é primeira análise (sem cache)
        is_first_analysis = not VideoCache.query.filter_by(
            user_id=current_user.id,
            channel_id=channel_info['id']
        ).first()
        
        if is_first_analysis:
            # Análise completa (como antes)
            results = analyzer.analyze_channel_complete(channel_name)
            if not results:
                return jsonify({'message': 'Channel analysis failed'}), 400
        else:
            # Análise otimizada - apenas vídeos novos
            all_videos, new_videos = analyzer.get_new_videos_only(
                channel_info['id'],
                current_user.id
            )
            
            if not all_videos:
                return jsonify({'message': 'Failed to get videos'}), 400
                
            all_comments = []
            # Analisa apenas comentários dos vídeos novos
            for video in new_videos:
                comments = analyzer.get_all_comments(video['id'])
                if comments:
                    all_comments.extend(comments)
                time.sleep(1)
            
            # Adiciona comentários do cache para os vídeos antigos
            cached_comments = CommentAnalysis.query.join(Analysis)\
                .filter(
                    Analysis.user_id == current_user.id,
                    Analysis.channel_id == channel_info['id']
                ).all()
            
            all_comments.extend([{
                'id': c.id,
                'video_id': c.video_id,
                'author': c.author,
                'text': c.text,
                'likes': c.likes,
                'sentiment': c.sentiment,
                'published_at': c.published_at.isoformat() if c.published_at else None
            } for c in cached_comments])
            
            pie_chart, bar_chart, sentiment_stats = analyzer.generate_charts(all_comments)
            
            results = {
                'channel_info': channel_info,
                'videos': {
                    'count': len(all_videos),
                    'all_videos': all_videos,
                },
                'comments': {
                    'count': len(all_comments),
                    'all_comments': all_comments,
                },
                'sentiment_analysis': {
                    'pie_chart': pie_chart,
                    'bar_chart': bar_chart,
                    'stats': sentiment_stats
                }
            }
        
        # Salva análise no banco de dados
        analysis = Analysis(
            user_id=current_user.id,
            channel_id=results['channel_info']['id'],
            channel_name=channel_name,
            subscriber_count=results['channel_info']['subscribers'],
            video_count=results['videos']['count'],
            total_views=sum(v['views'] for v in results['videos']['all_videos']),
            total_comments=results['comments']['count'],
            positive_comments=results['sentiment_analysis']['stats']['positive'],
            neutral_comments=results['sentiment_analysis']['stats']['neutral'],
            negative_comments=results['sentiment_analysis']['stats']['negative'],
            sentiment_pie_chart=results['sentiment_analysis']['pie_chart'],
            sentiment_bar_chart=results['sentiment_analysis']['bar_chart']
        )
        
        db.session.add(analysis)
        db.session.commit()
        
        # Atualiza o cache com os novos vídeos
        if not is_first_analysis:
            # Remove cache antigo
            VideoCache.query.filter_by(
                user_id=current_user.id,
                channel_id=channel_info['id']
            ).delete()
            
        # Adiciona todos os vídeos atuais ao cache
        for video in results['videos']['all_videos']:
            cache_entry = VideoCache(
                user_id=current_user.id,
                channel_id=channel_info['id'],
                video_id=video['id'],
                analysis_data={
                    'title': video['title'],
                    'views': video['views'],
                    'likes': video['likes'],
                    'comments': video['comments'],
                    'published_at': video['published_at'],
                    'thumbnail': video.get('thumbnail', ''),
                    'description': video.get('description', '')
                }
            )
            db.session.add(cache_entry)
        
        # Salva vídeos no banco
        for video in results['videos']['all_videos']:
            video_analysis = VideoAnalysis(
                analysis_id=analysis.id,
                video_id=video['id'],
                title=video['title'],
                views=video['views'],
                likes=video['likes'],
                comments=video['comments'],
                published_at=datetime.fromisoformat(video['published_at'].replace('Z', '+00:00'))
            )
            db.session.add(video_analysis)
        
        # Salva comentários no banco
        for comment in results['comments']['all_comments']:
            comment_analysis = CommentAnalysis(
                analysis_id=analysis.id,
                video_id=comment.get('video_id', ''),
                author=comment['author'],
                text=comment['text'],
                likes=comment['likes'],
                sentiment=comment['sentiment'],
                published_at=datetime.fromisoformat(comment['published_at'].replace('Z', '+00:00'))
            )
            db.session.add(comment_analysis)
        
        db.session.commit()
        
        current_user.last_analysis = datetime.now(timezone.utc)
        current_user.analysis_count += 1
        db.session.commit()
        
        return jsonify({
            'message': 'Analysis completed successfully',
            'optimized': not is_first_analysis,
            'new_videos_analyzed': len(new_videos) if not is_first_analysis else 0,
            'data': {
                'channel_info': results['channel_info'],
                'videos_count': len(results['videos']['all_videos']),
                'comments_count': len(results['comments']['all_comments'])
            }
        }), 200
        
    except Exception as e:
        logging.error(f"Analysis error: {str(e)}", exc_info=True)
        return jsonify({'message': 'Analysis failed', 'error': str(e)}), 500

@app.route('/api/user', methods=['GET'])
@token_required
def get_user(current_user):
    try:
        logging.info(f"Fetching user data for: {current_user.email}")
        return jsonify({
            'id': current_user.id,
            'name': current_user.name,
            'email': current_user.email,
            'youtube_channel': current_user.youtube_channel,
            'last_analysis': current_user.last_analysis.isoformat() if current_user.last_analysis else None,
            'analysis_count': current_user.analysis_count
        }), 200
    except Exception as e:
        logging.error(f"User data fetch error: {str(e)}", exc_info=True)
        return jsonify({
            'message': 'Failed to fetch user data', 
            'error': str(e)
        }), 500

@app.route('/api/analyses', methods=['GET'])
@token_required
def get_analyses(current_user):
    try:
        logging.info(f"Fetching analyses for user: {current_user.email}")
        analyses = Analysis.query.filter_by(user_id=current_user.id)\
                               .order_by(Analysis.analysis_date.desc())\
                               .all()
        
        result = []
        for analysis in analyses:
            result.append({
                'id': analysis.id,
                'channel_name': analysis.channel_name,
                'date': analysis.analysis_date.isoformat(),
                'subscribers': analysis.subscriber_count,
                'videos': analysis.video_count,
                'views': analysis.total_views,
                'comments': analysis.total_comments
            })
            
        return jsonify({'analyses': result}), 200
    except Exception as e:
        logging.error(f"Analyses fetch error: {str(e)}", exc_info=True)
        return jsonify({
            'message': 'Failed to fetch analyses', 
            'error': str(e)
        }), 500

@app.route('/api/analysis/<int:analysis_id>', methods=['GET'])
@token_required
def get_analysis(current_user, analysis_id):
    try:
        logging.info(f"Fetching analysis {analysis_id} for user {current_user.id}")
        analysis = Analysis.query.filter_by(id=analysis_id, user_id=current_user.id).first()
        
        if not analysis:
            return jsonify({'message': 'Analysis not found'}), 404
            
        videos = [{
            'id': v.video_id,
            'title': v.title,
            'views': v.views,
            'likes': v.likes,
            'comments': v.comments,
            'published_at': v.published_at.isoformat() if v.published_at else None
        } for v in analysis.videos]
        
        comments = [{
            'author': c.author,
            'text': c.text,
            'likes': c.likes,
            'sentiment': c.sentiment,
            'published_at': c.published_at.isoformat() if c.published_at else None
        } for c in analysis.comments]
        
        return jsonify({
            'id': analysis.id,
            'channel_name': analysis.channel_name,
            'date': analysis.analysis_date.isoformat(),
            'subscribers': analysis.subscriber_count,
            'videos': analysis.video_count,
            'views': analysis.total_views,
            'comments': analysis.total_comments,
            'sentiment': {
                'positive': analysis.positive_comments,
                'neutral': analysis.neutral_comments,
                'negative': analysis.negative_comments,
                'pie_chart': analysis.sentiment_pie_chart,
                'bar_chart': analysis.sentiment_bar_chart
            },
            'videos_sample': videos[:10],
            'comments_sample': comments[:20]
        }), 200
    except Exception as e:
        logging.error(f"Analysis fetch error: {str(e)}", exc_info=True)
        return jsonify({
            'message': 'Failed to fetch analysis', 
            'error': str(e)
        }), 500
    
@app.route('/api/videos', methods=['GET'])
@token_required
def get_videos(current_user):
    try:
        logging.info(f"Fetching videos for user {current_user.id}")
        
        last_analysis = Analysis.query.filter_by(user_id=current_user.id)\
                                    .order_by(Analysis.analysis_date.desc())\
                                    .first()
        
        if not last_analysis:
            logging.warning(f"No analysis found for user {current_user.id}")
            return jsonify({
                'message': 'No videos found',
                'videos': [],
                'pagination': {}
            }), 200
            
        videos = VideoAnalysis.query.filter_by(analysis_id=last_analysis.id)\
                                  .order_by(VideoAnalysis.published_at.desc())\
                                  .all()
        
        logging.info(f"Found {len(videos)} videos for analysis {last_analysis.id}")

        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 5, type=int)
        
        start = (page - 1) * per_page
        end = start + per_page
        paginated_videos = videos[start:end]
        
        videos_data = [{
            'video_id': video.video_id,
            'title': video.title,
            'views': video.views,
            'likes': video.likes,
            'comments': video.comments,
            'published_at': video.published_at.isoformat() if video.published_at else None,
            'thumbnail': f'https://img.youtube.com/vi/{video.video_id}/hqdefault.jpg'
        } for video in paginated_videos]
        
        return jsonify({
            'videos': videos_data,
            'pagination': {
                'total': len(videos),
                'pages': (len(videos) + per_page - 1) // per_page,
                'current_page': page,
                'per_page': per_page
            }
        }), 200
        
    except Exception as e:
        logging.error(f"Error getting videos: {str(e)}", exc_info=True)
        return jsonify({
            'message': 'Failed to get videos', 
            'error': str(e),
            'videos': []
        }), 500

@app.route('/api/videos/<video_id>/metrics', methods=['GET'])
@token_required
def get_video_metrics(current_user, video_id):
    try:
        logging.info(f"Fetching metrics for video {video_id}")
        
        video = VideoAnalysis.query.join(Analysis)\
                                 .filter(
                                     VideoAnalysis.video_id == video_id,
                                     Analysis.user_id == current_user.id
                                 )\
                                 .first()

        if not video:
            logging.warning(f"Video {video_id} not found for user {current_user.id}")
            return jsonify({
                'message': 'Video not found or not authorized',
                'views': 0,
                'likes': 0,
                'comments': 0
            }), 404

        return jsonify({
            'views': video.views,
            'likes': video.likes,
            'comments': video.comments
        }), 200

    except Exception as e:
        logging.error(f"Error getting video metrics: {str(e)}", exc_info=True)
        return jsonify({
            'message': 'Failed to get video metrics',
            'error': str(e)
        }), 500
    
@app.route('/api/videos/<video_id>/analyze-comments', methods=['POST'])
@token_required
def analyze_video_comments(current_user, video_id):
    try:
        logging.info(f"Analyzing comments for video {video_id}")
        
        # Busca os comentários no banco de dados
        comments = CommentAnalysis.query.join(Analysis)\
                                      .filter(
                                          CommentAnalysis.video_id == video_id,
                                          Analysis.user_id == current_user.id
                                      )\
                                      .all()

        if not comments:
            return jsonify({'message': 'No comments found'}), 404

        analyzer = SentimentIntensityAnalyzer()
        sentiment_counts = {'positive': 0, 'neutral': 0, 'negative': 0}
        analyzed_comments = []

        for comment in comments:
            # Atualiza a análise de sentimento se necessário
            if not comment.sentiment:
                sentiment = analyzer.analyze_sentiment(comment.text)
                comment.sentiment = sentiment
                db.session.commit()
            
            sentiment_counts[comment.sentiment] += 1
            analyzed_comments.append({
                'id': comment.id,
                'sentiment': comment.sentiment
            })

        return jsonify({
            'message': 'Analysis completed',
            'sentiment_counts': sentiment_counts,
            'comments': analyzed_comments
        }), 200

    except Exception as e:
        logging.error(f"Error analyzing comments: {str(e)}", exc_info=True)
        return jsonify({
            'message': 'Analysis failed',
            'error': str(e)
        }), 500

@app.route('/api/update-channel', methods=['PUT'])
@token_required
def update_channel(current_user):
    try:
        data = request.get_json()
        channel_name = data.get('youtube_channel')
        logging.info(f"Updating channel for user {current_user.id} to {channel_name}")
        
        if not channel_name:
            return jsonify({'message': 'Channel name is required'}), 400
            
        current_user.youtube_channel = channel_name.strip()
        db.session.commit()
        
        return jsonify({
            'message': 'Channel updated successfully', 
            'youtube_channel': channel_name
        }), 200
    except Exception as e:
        logging.error(f"Channel update error: {str(e)}", exc_info=True)
        return jsonify({
            'message': 'Failed to update channel', 
            'error': str(e)
        }), 500

@app.route('/api/all-videos', methods=['GET'])
@token_required
def get_all_videos(current_user):
    try:
        logging.info(f"Fetching all videos for user {current_user.id}")
        
        last_analysis = Analysis.query.filter_by(user_id=current_user.id)\
                                    .order_by(Analysis.analysis_date.desc())\
                                    .first()
        
        if not last_analysis:
            logging.warning(f"No analysis found for user {current_user.id}")
            return jsonify({
                'message': 'No videos found',
                'videos': []
            }), 200
            
        videos = VideoAnalysis.query.filter_by(analysis_id=last_analysis.id)\
                                  .order_by(VideoAnalysis.published_at.desc())\
                                  .all()
        
        videos_data = [{
            'video_id': video.video_id,
            'title': video.title,
            'views': video.views,
            'likes': video.likes,
            'comments': video.comments,
            'published_at': video.published_at.isoformat() if video.published_at else None,
            'thumbnail': f'https://img.youtube.com/vi/{video.video_id}/hqdefault.jpg',
            'comments_count': CommentAnalysis.query.filter_by(video_id=video.video_id).count()
        } for video in videos]
        
        return jsonify({
            'videos': videos_data,
            'total': len(videos_data)
        }), 200
        
    except Exception as e:
        logging.error(f"Error getting all videos: {str(e)}", exc_info=True)
        return jsonify({
            'message': 'Failed to get videos', 
            'error': str(e)
        }), 500

@app.route('/api/videos/<video_id>/comments', methods=['GET'])
@token_required
def get_video_comments(current_user, video_id):
    try:
        video_id = unquote(video_id)
        logging.info(f"Fetching comments for video {video_id} for user {current_user.id}")

        video = db.session.query(VideoAnalysis)\
                        .join(Analysis)\
                        .filter(
                            VideoAnalysis.video_id == video_id,
                            Analysis.user_id == current_user.id
                        )\
                        .first()

        if not video:
            logging.warning(f"Video {video_id} not found for user {current_user.id}")
            return jsonify({
                'success': False,
                'message': 'Video not found or not authorized',
                'video_id': video_id,
                'comments': []
            }), 404

        comments = db.session.query(CommentAnalysis)\
                          .filter(
                              CommentAnalysis.video_id == video_id,
                              CommentAnalysis.analysis_id == video.analysis_id
                          )\
                          .distinct(CommentAnalysis.id)\
                          .order_by(CommentAnalysis.published_at.desc())\
                          .all()

        logging.info(f"Encontrado{len(comments)}comentarios unicos para o vídeo {video_id}")

        comments_data = []
        for comment in comments:
            comments_data.append({
                'id': comment.id,
                'video_id': comment.video_id,
                'author': comment.author,
                'text': comment.text,
                'likes': comment.likes,
                'sentiment': comment.sentiment,
                'published_at': comment.published_at.isoformat() if comment.published_at else None,
                'analysis_id': comment.analysis_id
            })

        return jsonify({
            'success': True,
            'video_id': video_id,
            'video_title': video.title,
            'analysis_id': video.analysis_id,
            'comments_count': len(comments_data),
            'comments': comments_data
        }), 200

    except Exception as e:
        logging.error(f"Error getting video comments: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': 'Failed to get video comments',
            'error': str(e),
            'video_id': video_id,
            'comments': []
        }), 500

@app.route('/api/check-channel-updates', methods=['POST'])
@token_required
def check_channel_updates(current_user):
    try:
        data = request.get_json()
        if not data:
            return jsonify({'message': 'Dados inválidos'}), 400
            
        channel_name = unquote(data.get('channel_name', current_user.youtube_channel)).strip()
        logging.info(f"Iniciando verificação de atualizações para o canal: {channel_name}")
        
        if not channel_name:
            return jsonify({'message': 'Nome do canal não fornecido'}), 400

        analyzer = YouTubeAnalyzer()
        channel_info = analyzer.get_channel_info(channel_name)
        
        if not channel_info:
            logging.error(f"Canal não encontrado: {channel_name}")
            return jsonify({'message': 'Canal não encontrado'}), 404
            
        # Obter a última análise do banco de dados
        last_analysis = Analysis.query.filter_by(
            user_id=current_user.id,
            channel_id=channel_info['id']
        ).order_by(Analysis.analysis_date.desc()).first()
        
        if not last_analysis:
            logging.info("Nenhuma análise anterior encontrada - análise completa necessária")
            return jsonify({
                'has_updates': True,
                'message': 'Nenhuma análise anterior encontrada',
                'requires_full_analysis': True
            }), 200
            
        # Obter o último vídeo do banco de dados (ordenado por published_at decrescente)
        last_video_db = VideoAnalysis.query.filter_by(
            analysis_id=last_analysis.id
        ).order_by(VideoAnalysis.published_at.desc()).first()
        
        if not last_video_db:
            logging.error("Nenhum vídeo encontrado na última análise")
            return jsonify({
                'has_updates': True,
                'message': 'Nenhum vídeo na última análise',
                'requires_full_analysis': True
            }), 200

        # Obter o último vídeo do YouTube
        youtube = analyzer.get_youtube_service()
        search_response = youtube.search().list(
            channelId=channel_info['id'],
            part="id,snippet",
            maxResults=1,
            order="date",
            type="video"
        ).execute()
        
        if not search_response.get('items'):
            logging.info("Nenhum vídeo encontrado no canal do YouTube")
            return jsonify({
                'has_updates': False,
                'message': 'Nenhum vídeo encontrado no canal'
            }), 200
            
        last_video_yt = search_response['items'][0]
        last_video_yt_id = last_video_yt['id']['videoId']
        
        # IDs
        logging.info(f"Último vídeo no banco: {last_video_db.video_id}")
        logging.info(f"Último vídeo no YouTube: {last_video_yt_id}")
        
        # Comparar os vídeos
        has_updates = last_video_db.video_id != last_video_yt_id
        
        logging.info(f"Verificação concluída. Atualizações: {has_updates}")
        
        return jsonify({
            'success': True,
            'has_updates': has_updates,
            'message': 'Verificação concluída',
            'last_video_id': last_video_yt_id,
            'last_video_title': last_video_yt['snippet']['title'],
            'requires_full_analysis': False,
            'db_video_id': last_video_db.video_id,
            'yt_video_id': last_video_yt_id
        }), 200
        
    except HttpError as e:
        error_msg = f"Erro na API do YouTube: {str(e)}"
        logging.error(error_msg)
        return jsonify({
            'success': False,
            'message': error_msg,
            'error': 'youtube_api_error'
        }), 502
    except Exception as e:
        error_msg = f"Erro interno: {str(e)}"
        logging.error(error_msg, exc_info=True)
        return jsonify({
            'success': False,
            'message': error_msg,
            'error': 'internal_error'
        }), 500
    
@app.route('/api/analyze-new-videos', methods=['POST'])
@token_required
def analyze_new_videos(current_user):
    try:
        data = request.get_json()
        channel_name = unquote(data.get('channel_name', current_user.youtube_channel)).strip()
        last_video_id = data.get('last_video_id')
        
        if not last_video_id:
            return jsonify({'message': 'Last video ID is required'}), 400
            
        analyzer = YouTubeAnalyzer()
        channel_info = analyzer.get_channel_info(channel_name)
        if not channel_info:
            return jsonify({'message': 'Channel not found'}), 404
            
        # 1. Obter apenas o novo vídeo
        youtube = analyzer.get_youtube_service()
        videos_response = youtube.videos().list(
            id=last_video_id,
            part="snippet,statistics"
        ).execute()
        
        if not videos_response.get('items'):
            return jsonify({'message': 'Video not found'}), 404
            
        new_video = videos_response['items'][0]
        video_data = {
            'id': new_video['id'],
            'title': new_video['snippet']['title'],
            'views': int(new_video['statistics'].get('viewCount', 0)),
            'likes': int(new_video['statistics'].get('likeCount', 0)),
            'comments': int(new_video['statistics'].get('commentCount', 0)),
            'published_at': new_video['snippet']['publishedAt'],
            'thumbnail': new_video['snippet']['thumbnails']['high']['url'],
            'description': new_video['snippet'].get('description', '')
        }
        
        # 2. Analisar comentários apenas do novo vídeo
        all_comments = []
        comments = analyzer.get_all_comments(video_data['id'])
        if comments:
            all_comments.extend(comments)
        
        # 3. Atualizar a análise existente
        last_analysis = Analysis.query.filter_by(
            user_id=current_user.id,
            channel_id=channel_info['id']
        ).order_by(Analysis.analysis_date.desc()).first()
        
        if not last_analysis:
            return jsonify({'message': 'No analysis found to update'}), 404
            
        # Adicionar o novo vídeo
        video_analysis = VideoAnalysis(
            analysis_id=last_analysis.id,
            video_id=video_data['id'],
            title=video_data['title'],
            views=video_data['views'],
            likes=video_data['likes'],
            comments=video_data['comments'],
            published_at=datetime.fromisoformat(video_data['published_at'].replace('Z', '+00:00'))
        )
        db.session.add(video_analysis)
        
        # Adicionar os novos comentários
        for comment in all_comments:
            comment_analysis = CommentAnalysis(
                analysis_id=last_analysis.id,
                video_id=comment.get('video_id', ''),
                author=comment['author'],
                text=comment['text'],
                likes=comment['likes'],
                sentiment=comment['sentiment'],
                published_at=datetime.fromisoformat(comment['published_at'].replace('Z', '+00:00'))
            )
            db.session.add(comment_analysis)
        
        # Atualizar métricas da análise
        last_analysis.video_count += 1
        last_analysis.total_views += video_data['views']
        last_analysis.total_comments += len(all_comments)
        last_analysis.positive_comments += sum(1 for c in all_comments if c['sentiment'] == 'positive')
        last_analysis.neutral_comments += sum(1 for c in all_comments if c['sentiment'] == 'neutral')
        last_analysis.negative_comments += sum(1 for c in all_comments if c['sentiment'] == 'negative')
        
        # Atualizar cache
        cache_entry = VideoCache(
            user_id=current_user.id,
            channel_id=channel_info['id'],
            video_id=video_data['id'],
            analysis_data={
                'title': video_data['title'],
                'views': video_data['views'],
                'likes': video_data['likes'],
                'comments': video_data['comments'],
                'published_at': video_data['published_at'],
                'thumbnail': video_data['thumbnail'],
                'description': video_data['description']
            }
        )
        db.session.add(cache_entry)
        
        db.session.commit()
        
        return jsonify({
            'message': 'New video analyzed successfully',
            'new_videos': 1,
            'new_comments': len(all_comments)
        })
        
    except Exception as e:
        logging.error(f"Error analyzing new videos: {str(e)}")
        return jsonify({
            'message': 'Error analyzing new videos',
            'error': str(e)
        }), 500
    

@app.route('/api/metrics', methods=['GET'])
@token_required
def get_metrics(current_user):
    try:
        logging.info(f"Fetching metrics for user {current_user.id}")
        
        last_analysis = Analysis.query.filter_by(user_id=current_user.id)\
                                    .order_by(Analysis.analysis_date.desc())\
                                    .first()
        
        if not last_analysis:
            return jsonify({
                'message': 'No metrics found',
                'views': 0,
                'likes': 0,
                'comments': 0,
                'subscribers': 0,
                'videos': 0
            }), 200
            
        total_likes = sum(v.likes for v in last_analysis.videos)
        
        return jsonify({
            'views': last_analysis.total_views,
            'likes': total_likes,
            'comments': last_analysis.total_comments,
            'subscribers': last_analysis.subscriber_count,
            'videos': last_analysis.video_count
        }), 200
        
    except Exception as e:
        logging.error(f"Error getting metrics: {str(e)}", exc_info=True)
        return jsonify({
            'message': 'Error getting metrics',
            'error': str(e)
        }), 500



@app.route('/api/analytics', methods=['GET'])
@token_required
def get_analytics(current_user):
    try:
        time_range = request.args.get('time_range', '30d')
        
        # Calcular a data de início baseada no período selecionado
        if time_range == '7d':
            start_date = datetime.now(timezone.utc) - timedelta(days=7)
        elif time_range == '15d':
            start_date = datetime.now(timezone.utc) - timedelta(days=15)
        elif time_range == '30d':
            start_date = datetime.now(timezone.utc) - timedelta(days=30)
        else: 
            start_date = None
        
        # Obter a última análise do usuário
        query = Analysis.query.filter_by(user_id=current_user.id)
        
        if start_date:
            query = query.filter(Analysis.analysis_date >= start_date)
            
        analyses = query.order_by(Analysis.analysis_date.desc()).all()
        
        if not analyses:
            return jsonify({'message': 'No analysis found'}), 404
        
        # Dados de engajamento
        engagement_data = {
            'labels': [],
            'datasets': [{
                'label': 'Visualizações',
                'data': [],
                'borderColor': '#4CAF50',
                'backgroundColor': 'rgba(75, 192, 192, 0.2)'
            }, {
                'label': 'Curtidas',
                'data': [],
                'borderColor': '#2196F3',
                'backgroundColor': 'rgba(33, 150, 243, 0.2)'
            }]
        }

        for analysis in reversed(analyses):  # Ordem cronológica
            date_str = analysis.analysis_date.strftime('%d/%m')
            engagement_data['labels'].append(date_str)
            engagement_data['datasets'][0]['data'].append(analysis.total_views)
            engagement_data['datasets'][1]['data'].append(
                sum(v.likes for v in analysis.videos)
            )
        
        # Dados de sentimento (somar todas as análises)
        positive = sum(a.positive_comments for a in analyses)
        neutral = sum(a.neutral_comments for a in analyses)
        negative = sum(a.negative_comments for a in analyses)
        
        sentiment_data = {
            'doughnut': {
                'labels': ['Positivo', 'Neutro', 'Negativo'],
                'datasets': [{
                    'data': [positive, neutral, negative],
                    'backgroundColor': ['#4CAF50', '#FFC107', '#F44336']
                }]
            },
            'bar': {
                'labels': ['Positivo', 'Neutro', 'Negativo'],
                'datasets': [{
                    'label': 'Comentários',
                    'data': [positive, neutral, negative],
                    'backgroundColor': ['#4CAF50', '#FFC107', '#F44336']
                }]
            }
        }
        
        # Métricas de performance
        performance_data = {
            'CTR': '5.2%',
            'CTR_trend': 'up',
            'CTR_change': '0.5%',
            'Retention': '62%',
            'Retention_trend': 'up',
            'Retention_change': '3%',
            'Engagement': '7.8%',
            'Engagement_trend': 'down',
            'Engagement_change': '0.8%',
            'New_Subscribers': (analyses[0].subscriber_count - analyses[-1].subscriber_count) 
                              if len(analyses) > 1 else 0,
            'New_Subscribers_trend': 'up' if len(analyses) > 1 and 
                                      analyses[0].subscriber_count >= analyses[-1].subscriber_count else 'down',
            'New_Subscribers_change': abs(analyses[0].subscriber_count - analyses[-1].subscriber_count) 
                                     if len(analyses) > 1 else 0
        }
        
        # Top vídeos (última análise)
        last_analysis = analyses[0]
        top_videos = VideoAnalysis.query.filter_by(analysis_id=last_analysis.id)\
                                     .order_by(VideoAnalysis.views.desc())\
                                     .limit(5)\
                                     .all()
        
        top_videos_data = [{
            'video_id': v.video_id,
            'title': v.title,
            'views': v.views,
            'likes': v.likes,
            'comments': v.comments,
            'published_at': v.published_at.isoformat() if v.published_at else None
        } for v in top_videos]
        
        # Top comentários (última análise)
        top_comments = CommentAnalysis.query.filter_by(analysis_id=last_analysis.id)\
                                         .order_by(CommentAnalysis.likes.desc())\
                                         .limit(5)\
                                         .all()
        
        top_comments_data = [{
            'author': c.author,
            'text': c.text,
            'likes': c.likes,
            'sentiment': c.sentiment,
            'published_at': c.published_at.isoformat() if c.published_at else None
        } for c in top_comments]
        
        return jsonify({
            'engagement': engagement_data,
            'sentiment': sentiment_data,
            'performance': performance_data,
            'top_videos': top_videos_data,
            'top_comments': top_comments_data
        }), 200
        
    except Exception as e:
        logging.error(f"Error getting analytics: {str(e)}")
        return jsonify({'message': 'Error getting analytics'}), 500

@app.route('/api/videos/<video_id>/analytics', methods=['GET'])
@token_required
def get_video_analytics(current_user, video_id):
    try:
        logging.info(f"Fetching analytics for video {video_id}")
        
        # Verificar se o vídeo pertence ao usuário
        video = VideoAnalysis.query.join(Analysis)\
                                 .filter(
                                     VideoAnalysis.video_id == video_id,
                                     Analysis.user_id == current_user.id
                                 )\
                                 .first()

        if not video:
            return jsonify({'success': False, 'message': 'Video not found'}), 404

        # Obter todos os comentários do vídeo
        comments = CommentAnalysis.query.filter_by(
            analysis_id=video.analysis_id,
            video_id=video_id
        ).all()

        # Calcular estatísticas de sentimento
        sentiment_counts = {
            'positive': 0,
            'neutral': 0,
            'negative': 0
        }

        for comment in comments:
            sentiment_counts[comment.sentiment] += 1

        # Obter todas as análises deste vídeo ao longo do tempo
        video_analyses = VideoAnalysis.query.join(Analysis)\
                                          .filter(
                                              VideoAnalysis.video_id == video_id,
                                              Analysis.user_id == current_user.id
                                          )\
                                          .order_by(Analysis.analysis_date.asc())\
                                          .all()

        # Preparar dados para o gráfico de engajamento
        engagement_data = {
            'labels': [analysis.analysis.analysis_date.strftime('%d/%m/%Y') for analysis in video_analyses],
            'datasets': [
                {
                    'label': 'Visualizações',
                    'data': [analysis.views for analysis in video_analyses],
                    'borderColor': '#4CAF50',
                    'backgroundColor': 'rgba(75, 192, 192, 0.2)'
                },
                {
                    'label': 'Curtidas',
                    'data': [analysis.likes for analysis in video_analyses],
                    'borderColor': '#2196F3',
                    'backgroundColor': 'rgba(33, 150, 243, 0.2)'
                },
                {
                    'label': 'Comentários',
                    'data': [analysis.comments for analysis in video_analyses],
                    'borderColor': '#FF9800',
                    'backgroundColor': 'rgba(255, 152, 0, 0.2)'
                }
            ]
        }

        return jsonify({
            'success': True,
            'engagement': engagement_data,
            'sentiment': {
                'positive': sentiment_counts['positive'],
                'neutral': sentiment_counts['neutral'],
                'negative': sentiment_counts['negative']
            },
            'performance': {
                'current_views': video.views,
                'current_likes': video.likes,
                'current_comments': video.comments
            }
        }), 200

    except Exception as e:
        logging.error(f"Error in video analytics: {str(e)}")
        return jsonify({'success': False, 'message': 'Error fetching analytics'}), 500
    

@app.route('/api/export-analysis/<int:analysis_id>', methods=['GET'])
@token_required
def export_analysis(current_user, analysis_id):
    try:
        logging.info(f"Exporting analysis {analysis_id} for user {current_user.id}")
        
        # Verificar se a análise pertence ao usuário
        analysis = Analysis.query.filter_by(
            id=analysis_id,
            user_id=current_user.id
        ).first()
        
        if not analysis:
            return jsonify({'message': 'Analysis not found or not authorized'}), 404
        
        # Criar um buffer para o CSV
        buffer = BytesIO()
        
        # Criar um escritor CSV
        writer = csv.writer(buffer)
        
        # Escrever cabeçalhos do resumo do canal
        writer.writerow(["Resumo do Canal"])
        writer.writerow(["Métrica", "Valor", "Positivos", "Neutros", "Negativos", "Total Comentários"])
        
        # Adicionar dados do canal
        channel_data = [
            ["Inscritos", analysis.subscriber_count],
            ["Vídeos", analysis.video_count],
            ["Visualizações", analysis.total_views],
            ["Curtidas", sum(v.likes for v in analysis.videos)],
            ["Comentários", analysis.total_comments]
        ]
        
        for row in channel_data:
            writer.writerow([
                row[0], row[1],
                analysis.positive_comments,
                analysis.neutral_comments,
                analysis.negative_comments,
                analysis.total_comments
            ])
        
        # Adicionar linha em branco
        writer.writerow([])
        writer.writerow(["Vídeos"])
        writer.writerow(["Título", "Visualizações", "Curtidas", "Comentários", "Data de Publicação", "Taxa de Curtidas (%)", "Taxa de Comentários (%)"])
        
        # Adicionar dados dos vídeos
        for video in analysis.videos:
            like_rate = (video.likes / video.views * 100) if video.views > 0 else 0
            comment_rate = (video.comments / video.views * 100) if video.views > 0 else 0
            
            writer.writerow([
                video.title,
                video.views,
                video.likes,
                video.comments,
                video.published_at.strftime('%Y-%m-%d %H:%M') if video.published_at else '',
                f"{like_rate:.2f}",
                f"{comment_rate:.2f}"
            ])
        
        # Adicionar linha em branco
        writer.writerow([])
        writer.writerow(["Comentários mais relevantes"])
        writer.writerow(["Vídeo", "Autor", "Comentário", "Curtidas", "Sentimento", "Data"])
        
        # Adicionar comentários mais relevantes
        top_comments = sorted(
            analysis.comments, 
            key=lambda c: c.likes, 
            reverse=True
        )[:100]  # Limitar a 100 comentários
        
        for comment in top_comments:
            video_title = next(
                (v.title for v in analysis.videos if v.video_id == comment.video_id),
                "Desconhecido"
            )
            
            writer.writerow([
                video_title,
                comment.author,
                comment.text,
                comment.likes,
                comment.sentiment.capitalize(),
                comment.published_at.strftime('%Y-%m-%d %H:%M') if comment.published_at else ''
            ])
        
        buffer.seek(0)
        
        # Nome do arquivo
        filename = f"analise_{analysis.channel_name}_{analysis.analysis_date.strftime('%Y%m%d')}.csv"
        
        # Enviar o arquivo como resposta
        return send_file(
            buffer,
            as_attachment=True,
            download_name=filename,
            mimetype='text/csv'
        )
        
    except Exception as e:
        logging.error(f"Error exporting analysis: {str(e)}", exc_info=True)
        return jsonify({'message': 'Failed to export analysis', 'error': str(e)}), 500
    
    
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        try:
            db.engine.execute('''
                CREATE UNIQUE INDEX idx_email_lower 
                ON user (LOWER(email))
            ''')
            logging.info("Case-insensitive index created")
        except Exception as e:
            logging.warning(f"Index already exists: {str(e)}")
    
    app.run(host='0.0.0.0', port=8080, debug=True)