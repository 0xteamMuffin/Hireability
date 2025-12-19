# Documentation

This directory contains additional documentation for the HireAbility project.

## System Design

<img src="system-design.svg" alt="System Design" style="max-width: 100%; height: auto;" />

HireAbility follows a modern microservices-inspired architecture:

- **Frontend**: Next.js application with React components
- **Backend**: Express.js REST API with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **AI**: Google Gemini API for analysis and generation
- **Voice**: VAPI for real-time voice conversations

## Architecture Diagram

```
Frontend (Next.js) → REST API → Backend (Express.js) → AI Agents (Gemini) → PostgreSQL
                    ↓
                 VAPI (WebSocket)
```

## Key Components

### AI Agents

- **FeedbackGeneratorAgent**: Analyzes interview transcripts and generates comprehensive feedback
- **QuestionGeneratorAgent**: Generates interview questions based on role and context
- **ResumeReviewGenerator**: Analyzes resumes and provides optimization suggestions
- **DocumentParserAgent**: Extracts structured data from uploaded documents

### Evaluation Criteria

Interviews are evaluated across 6 dimensions with weighted scoring:

- Technical Skills (20%)
- Problem Solving (20%)
- Role Knowledge (20%)
- Experience (15%)
- Communication (15%)
- Professional Demeanor (10%)

## Evaluation Notes

The AI evaluation system uses:

- Structured JSON output from Gemini models
- Weighted scoring algorithm for overall assessment
- Context-aware analysis based on target role and company
- Multi-dimensional feedback with strengths, weaknesses, and improvements

For detailed API documentation and setup instructions, see the main [README.md](../README.md).
