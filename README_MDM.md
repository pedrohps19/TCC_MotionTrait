
# 📊 Site MDM – Monitoramento de Dados e Métricas

Projeto composto por:

- **Front-end**: React com Vite (`/frontend`)
- **Back-end**: Flask com Python (`/server`)
- **Banco de Dados**: MySQL
---

## ✅ Requisitos

- Node.js (v18+ recomendado)
- Python 3.10+
- pip (gerenciador de pacotes Python)
- MySQL Workbench (8.0 recomendado)
---


## 📁 Estrutura do Projeto

```
/
├── frontend/      # Aplicação React com Vite
└── server/        # API Flask com autenticação e análise
```

---

## 🚀 Instalação e Execução

### 1. Banco de Dados MySQL

1. Instale o MySQL Community Server: [Download MySQL](https://dev.mysql.com/downloads/)
2. Configure a senha root durante a instalação
3. Verifique o serviço:
   ```cmd
   :: Windows
   net start MySQL80
   ```

### 🔹 Front-end (React + Vite)

1. Acesse a pasta:

```bash
cd frontend
```

2. Instale as dependências:

```bash
npm install
```

3. Rode a aplicação:

```bash
npm run dev
```

Acesse em: [http://localhost:5173](http://localhost:5173)

---

### 🔹 Back-end (Flask + Python)

1. Acesse a pasta:

```bash
cd server
```

2. Instale as dependências (tudo em uma linha):

```bash
pip install Flask Flask-Cors Flask-Bcrypt Flask-SQLAlchemy python-dotenv PyJWT google-api-python-client vaderSentiment matplotlib seaborn openpyxl 
```

3. Configure o arquivo .env com as seguintes informações:
```
    DB_USER='root'
    DB_PASSWORD='sua senha do banco de dados'
    DB_HOST='localhost'
    DB_NAME='site'
    SECRET_KEY=df86a1261c5edef896e119b1b8ab5a73e67eca3a40a56048b16f78b43bfda48b
    YOUTUBE_API_KEY_1=""
    YOUTUBE_API_KEY_2=""
    YOUTUBE_API_KEY_3=""
    EMAIL_USER="algum email seu"
    EMAIL_PASSWORD="senha do email"
```

3. Rode a aplicação:

```bash
python app.py
```

Acesse em: [http://localhost:5000](http://localhost:5000)

---

## 🧪 Scripts Disponíveis

### Front-end

- `npm run dev` – Inicia servidor de desenvolvimento (recomendamos essa opção para testar a aplicação)
- `npm run build` – Build de produção
- `npm run preview` – Pré-visualiza a build local
- `npm run lint` – Executa o ESLint

---

## 📌 Observações (Importantes)

- Não se preocupe quanto a criação das tabelas no banco de dados, o próprio backend cria as tabelas automaticamente
- Rode o back-end antes do front-end para garantir o funcionamento completo.
- O projeto utiliza CORS para comunicação entre front e back.
- A API oferece autenticação, envio de e-mail, análise de sentimentos, exportação Excel e mais.

---

Projeto de TCC (Monitoramento de Marca) (UNIP - 2025)
Desenvolvido para análise e visualização de métricas de dados.
