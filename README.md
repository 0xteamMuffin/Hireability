# HireAbility - AI-Powered Mock Interview Platform

**Transform your interviewing journey with AI-powered mock interviews**

## 📋 Overview

HireAbility is an intelligent mock interview platform that leverages AI to provide realistic, personalized interview practice sessions. The platform conducts live AI-led interviews using audio and video, evaluates communication skills, technical accuracy, and confidence levels.

### Key Features

- 🎤 **Real-time AI Interviews**: Live voice and video interviews powered by VAPI
- 🤖 **Intelligent Analysis**: AI-powered evaluation using Google Gemini across 6 dimensions
- 📊 **Detailed Analytics**: Comprehensive feedback with scores, strengths, weaknesses, and improvements
- 📄 **Resume Review**: AI-powered resume analysis and optimization
- 🎯 **Personalized Experience**: Customized interviews based on target role, company, and level

## 🏗️ Architecture

<img src="docs/system-design.svg" alt="System Design" style="max-width: 100%; height: auto;" />

```
Frontend (Next.js) → REST API → Backend (Express.js) → AI Agents (Gemini) → PostgreSQL
                    ↓
                 VAPI (WebSocket)
```

### Tech Stack

**Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS, VAPI Web SDK  
**Backend:** Express.js, TypeScript, Prisma ORM, PostgreSQL, JWT  
**AI:** Google Gemini 1.5 Pro/Flash, VAPI Voice API

## 🚀 Setup

### Prerequisites
- Node.js 18+, PostgreSQL 14+
- Google Gemini API Key
- VAPI API Key and Assistant ID

### Environment Variables

**Backend (`be_hireability/.env`):**
```env
DATABASE_URL="postgresql://user:password@localhost:5432/hireability"
JWT_SECRET="your-secret-key"
GEMINI_API_KEY="your-gemini-api-key"
MODEL_NAME="gemini-1.5-pro"
PORT=3001
```

**Frontend (`fe_hireability/.env.local`):**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_VAPI_ASSISTANT_ID=your-vapi-assistant-id
```

### Installation

```bash
# Clone repository
git clone <repository-url>
cd hireability

# Setup Backend
cd be_hireability
npm install
npx prisma generate
npx prisma migrate dev
npm run dev

# Setup Frontend (new terminal)
cd fe_hireability
npm install
npm run dev
```

**Access:** Frontend: http://localhost:3000 | Backend: http://localhost:3001

## 📡 API Endpoints

**Base URL:** `http://localhost:3001/api`

### Authentication
- `POST /api/auth/register` - Register user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Interviews
- `POST /api/interviews` - Start interview
- `GET /api/interviews` - Get all interviews
- `GET /api/interviews/:id` - Get interview details
- `POST /api/interviews/:id/analyze` - Analyze transcript
- `GET /api/interviews/stats` - Get statistics

### Other
- `POST /api/transcripts` - Save transcript
- `POST /api/documents` - Upload resume
- `GET /api/profile` - Get/Update profile

**Authentication:** Include `Authorization: Bearer <token>` header

### Example Request

```bash
POST /api/interviews
Authorization: Bearer <token>
Content-Type: application/json

{
  "assistantId": "vapi-assistant-id",
  "contextPrompt": "Interview for Software Engineer at Google"
}
```

## 🧪 How It Works

1. **User starts interview** → System creates session
2. **VAPI connects** → Real-time voice conversation
3. **Transcript saved** → Conversation stored
4. **AI Analysis** → Gemini analyzes across 6 dimensions:
   - Technical Skills (20%)
   - Problem Solving (20%)
   - Role Knowledge (20%)
   - Experience (15%)
   - Communication (15%)
   - Professional Demeanor (10%)
5. **Feedback Generated** → Scores, strengths, weaknesses, improvements

### Sample Output

```json
{
  "technical": {
    "score": 8.5,
    "strengths": ["Strong system design knowledge"],
    "weaknesses": ["Could improve trade-off discussions"],
    "improvements": ["Practice explaining trade-offs"]
  },
  "overall": {
    "score": 7.8,
    "summary": "Solid performance with good technical skills"
  }
}
```

## 📁 Project Structure

```
hireability/
├── be_hireability/     # Backend (Express.js)
│   ├── src/
│   │   ├── agents/     # AI agents
│   │   ├── controllers/
│   │   ├── services/
│   │   └── routes/
│   └── prisma/         # Database schema
│
└── fe_hireability/     # Frontend (Next.js)
    ├── app/            # Pages
    ├── components/     # React components
    └── lib/            # Utilities
```

## 📦 Key Dependencies

**Backend:** express, @prisma/client, @google/genai, jsonwebtoken, bcryptjs  
**Frontend:** next, react, @vapi-ai/web, face-api.js, framer-motion

See `package.json` files for complete lists.

## 🚢 Deployment

**Backend:**
```bash
npm run build
npx prisma migrate deploy
npm start
```

**Frontend:**
```bash
npm run build
npm start
```

**Recommended:** Backend (Render/Railway), Frontend (Vercel/Netlify), Database (Supabase/Neon)

## 🎯 Status

**Completed (60-80%):**
- ✅ Core AI interview analysis
- ✅ Real-time VAPI interviews
- ✅ Transcript processing
- ✅ Multi-dimensional feedback
- ✅ User auth & profiles
- ✅ Resume review

**In Progress:**
- 🔄 Enhanced analytics
- 🔄 Real-time feedback

## 🤝 Contributors

- **shaunakc11** - Shaunak Choudhury
- **0xPixelNinja** - Rakesh Kumar Rabhi
- **gaghackz** - Karanam Gagan Deep
- **pranjal-kumar-0** - Pranjal Kumar

## 📄 License

MIT License

---

**Built for IIT Bombay Hackathon 2025**
