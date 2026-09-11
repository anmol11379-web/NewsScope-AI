# 📰 NewsScope AI — Fake News & Bias Detector

Hey there! 👋 Welcome to **NewsScope AI**. 

I built this project to tackle the widespread problem of misinformation, viral fake news, and biased media reporting. It's a full-stack AI-powered news verification chatbot that lets anyone paste a headline, claim, or article snippet to instantly get a credibility score, fact-check summary, bias analysis, and verified sources.

Powered by **Google Gemini 3.6 Flash** on the backend and an interactive chat interface on the frontend.

---

## 🔗 Live Links

- **🌐 Live Demo (Website)**: [https://newsscope-ai.netlify.app](https://newsscope-ai.netlify.app)
- **⚡ Backend API (Render)**: [https://newsscope-backend-zfr6.onrender.com](https://newsscope-backend-zfr6.onrender.com)
- **📖 API Docs (Swagger UI)**: [https://newsscope-backend-zfr6.onrender.com/docs](https://newsscope-backend-zfr6.onrender.com/docs)
- **💻 GitHub Repo**: [https://github.com/anmol11379-web/NewsScope-AI](https://github.com/anmol11379-web/NewsScope-AI)

---

## 💡 Why I Built This (Problem & Idea)

Every day on social media, WhatsApp, and news portals, thousands of misleading articles and manipulated claims go viral before people even check if they are true. 

Most people don't have the time to read through 5 different fact-checking websites. **NewsScope AI** solves this by acting like a personal AI news analyst:
1. You give it a claim or headline (by typing or using voice).
2. It evaluates the factual accuracy and checks for media bias / sensationalism.
3. It gives you a clear **Credibility Score (0 to 100)** with verified references (like Reuters, AP, WHO, BBC, Snopes).

---

## 🚀 Key Features

- **⚡ Instant AI Verification**: Uses Google's `gemini-3.6-flash` model to analyze claims in seconds.
- **📊 Credibility Score & Badges**: 
  - 🟢 **Verified & Accurate** (75–100%)
  - 🟡 **Partially Accurate / Needs Context** (45–74%)
  - 🔴 **Likely Misleading / False** (0–44%)
- **⚖️ Bias & Framing Check**: Flags sensationalism, clickbait, and political bias.
- **📚 Curated Benchmark Dataset**: Includes 50 verified ground-truth news cases across Science, Politics, Tech, and World News with a built-in search/filter modal.
- **🎙️ Voice Input**: Integrated Web Speech API so you can just speak your query.
- **💬 Chat History & Search**: Automatically saves recent conversations in the sidebar so you can review past checks.
- **🌓 Dark & Light Mode**: Clean, responsive UI that looks great on mobile and desktop.

---

## 🛠️ Tech Stack

### Frontend
- **HTML5 & CSS3** (Custom responsive design system, dark mode tokens)
- **Vanilla JavaScript (ES Modules)**
- **Vite** (for fast local development and building)
- **Web Speech API** (for speech-to-text)

### Backend
- **Python 3.10+**
- **FastAPI** (fast asynchronous REST API)
- **Uvicorn** (ASGI web server)
- **Google GenAI SDK** (`gemini-3.6-flash`)
- **Pydantic v2** (request/response validation)

### Deployment
- **Frontend**: Deployed on **Netlify** with automatic proxying to backend (`/api/*`).
- **Backend**: Hosted as a web service on **Render**.

---

## 🏗️ How It Works

```text
  [ User types claim / speaks via mic ]
                 │
                 ▼
     [ Frontend (Vite / Netlify) ]
                 │
                 ▼ (Proxied API call to /api/chat)
     [ FastAPI Backend on Render ]
                 │
      ┌──────────┴──────────┐
      ▼                     ▼
[Local Dataset]      [Google Gemini 3.6 Flash]
(Quick lookup for     (Deep fact-checking, bias check,
 50 benchmark claims)  score calculation, and sources)
      └──────────┬──────────┘
                 │
                 ▼
     [ Returns Structured JSON ]
                 │
                 ▼
[ Frontend displays interactive Fact-Check Card ]
```

---

## 💻 Local Setup & Installation

Want to run this project on your own machine? Follow these simple steps:

### 1. Clone the repository
```bash
git clone https://github.com/anmol11379-web/NewsScope-AI.git
cd "NewsScope AI"
```

### 2. Run the Backend (FastAPI)
```bash
# Move into backend folder
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# On Mac/Linux:
# source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

Create a `.env` file in the `backend/` folder:
```env
GEMINI_API_KEY=your_gemini_api_key_here
MODEL_NAME=gemini-3.6-flash
PORT=8000
```
*(You can get a free Gemini API key from [Google AI Studio](https://aistudio.google.com/))*

Now start the backend server:
```bash
uvicorn backend.main:app --reload --port 8000
```
Backend will be running at `http://127.0.0.1:8000` (Docs at `http://127.0.0.1:8000/docs`).

### 3. Run the Frontend (Vite)
Open another terminal:
```bash
# Move to frontend folder
cd frontend

# Install packages
npm install

# Start development server
npm run dev
```
Open `http://localhost:3000` in your browser!

---

## 📡 API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Check if backend and Gemini model are ready |
| `POST` | `/api/chat` | Main endpoint for news queries & chat |
| `POST` | `/api/verify` | Standalone verification endpoint for raw claims |
| `GET` | `/api/dataset` | Retrieve curated benchmark claims with search/filter |
| `GET` | `/api/dataset/stats`| Get statistics and category counts from benchmark data |
| `GET` | `/api/dataset/random`| Get a random claim to test |

---

## 🔮 What's Next / Future Improvements

- [ ] Add URL scraping so users can just paste a news link and have the whole article extracted.
- [ ] Add community upvoting / downvoting on verified claims.
- [ ] Multi-language news verification support.
- [ ] Browser extension to check articles directly while browsing.

---

## 👨‍💻 Author

**Anmol Mishra**
- GitHub: [@anmol11379-web](https://github.com/anmol11379-web)
- Project: [NewsScope AI](https://github.com/anmol11379-web/NewsScope-AI)

*If you found this project helpful or interesting, feel free to drop a ⭐ on GitHub!*
