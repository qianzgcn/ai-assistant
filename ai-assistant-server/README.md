# AI Assistant Server

A Python-based backend service for the AI Assistant chat application.

## Features

- **RESTful API** for conversation management
- **Streaming responses** via Server-Sent Events (SSE)
- **Multiple AI model support** (OpenAI-compatible API)
- **Local data persistence** with SQLite
- **Docker deployment** ready
- **CORS enabled** for cross-origin requests

## Quick Start

### Using Docker (Recommended)

```bash
# Build and run
docker build -t ai-assistant-server .
docker run -d -p 8000:8000 --name ai-assistant-server ai-assistant-server

# Or use docker-compose
docker-compose up -d
```

### Local Development

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## API Documentation

Once the server is running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Configuration

Environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key | Required |
| `OPENAI_BASE_URL` | OpenAI API base URL | `https://api.openai.com/v1` |
| `DATABASE_URL` | Database connection string | `sqlite:///./data/ai_assistant.db` |
| `CORS_ORIGINS` | Allowed CORS origins | `*` |
| `LOG_LEVEL` | Logging level | `INFO` |

## Project Structure

```
ai-assistant-server/
├── app/
│   ├── api/
│   │   └── endpoints/      # API route handlers
│   ├── core/
│   │   ├── config.py       # Configuration management
│   │   ├── database.py     # Database connection
│   │   └── security.py     # Security utilities
│   ├── models/
│   │   └── schemas.py      # Pydantic models
│   └── services/
│       ├── chat_service.py # Chat logic
│       └── openai_service.py # OpenAI API integration
├── tests/                   # Unit tests
├── docs/                    # Documentation
├── requirements.txt
├── Dockerfile
└── docker-compose.yml
```

## API Endpoints

### Conversations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/conversations` | List all conversations |
| POST | `/api/conversations` | Create new conversation |
| PUT | `/api/conversations/{id}` | Update conversation |
| DELETE | `/api/conversations/{id}` | Delete conversation |

### Chat

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat/stream` | Send message, stream response |
| POST | `/api/chat/regenerate` | Regenerate last answer |
| POST | `/api/chat/stop/{conversation_id}` | Stop streaming |

### Models

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/models` | List available models |

## License

MIT
