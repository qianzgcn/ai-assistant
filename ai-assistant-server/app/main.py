"""
AI Assistant Server - Main Application

This is the main entry point for the FastAPI application.
It configures:
- API routes
- CORS
- Database initialization
- Logging
"""

import logging
from contextlib import asynccontextmanager
from typing import List

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.endpoints import chat, conversations, models
from app.core.config import settings
from app.core.database import check_db_connection, close_db, init_db

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper()),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    
    Handles startup and shutdown events:
    - Startup: Initialize database
    - Shutdown: Close database connections
    """
    # Startup
    logger.info(f"Starting {settings.app_name}...")
    logger.info(f"Debug mode: {settings.debug}")
    logger.info(f"Database: {settings.database_url}")
    
    # Initialize database
    try:
        await init_db()
        logger.info("Database initialized successfully")
        
        # Verify connection
        if await check_db_connection():
            logger.info("Database connection verified")
        else:
            logger.warning("Database connection could not be verified")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        raise
    
    yield
    
    # Shutdown
    logger.info("Shutting down...")
    await close_db()
    logger.info("Database connections closed")


# Create FastAPI application
app = FastAPI(
    title=settings.app_name,
    description="""
## AI Assistant Backend Server

A Python-based backend service providing:
- **Conversation Management**: Create, read, update, delete conversations
- **Chat Streaming**: Real-time streaming responses via Server-Sent Events (SSE)
- **Multiple AI Models**: Support for various OpenAI models
- **Local Persistence**: SQLite database for storing conversations and messages

## API Features

- RESTful API design
- OpenAPI documentation (Swagger UI)
- CORS enabled for cross-origin requests
- Streaming responses for real-time chat

## Frontend Integration

The frontend should use the following endpoints:
- `POST /api/chat/stream` - Send messages and receive streaming responses
- `GET /api/conversations` - List all conversations
- `POST /api/conversations` - Create new conversation
- `GET /api/models` - List available AI models

For streaming, set `Accept: text/event-stream` header.
    """,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)


# =============================================================================
# CORS Configuration
# =============================================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# Exception Handlers
# =============================================================================

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError
):
    """
    Handle request validation errors.
    
    Returns a cleaner error message for validation failures.
    """
    errors = []
    for error in exc.errors():
        field = ".".join(str(loc) for loc in error["loc"])
        errors.append(f"{field}: {error['msg']}")
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "error": "Validation error",
            "detail": "; ".join(errors)
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """
    Handle unexpected exceptions.
    
    Returns a generic error message for unexpected errors.
    """
    logger.exception(f"Unexpected error: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error": "Internal server error",
            "detail": str(exc) if settings.debug else "An unexpected error occurred"
        }
    )


# =============================================================================
# Include Routers
# =============================================================================

app.include_router(conversations.router)
app.include_router(chat.router)
app.include_router(models.router)


# =============================================================================
# Root Endpoint
# =============================================================================

@app.get("/", tags=["Root"])
async def root():
    """
    Root endpoint returning API information.
    """
    return {
        "name": settings.app_name,
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc"
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """
    Basic health check endpoint.
    """
    db_healthy = await check_db_connection()
    return {
        "status": "healthy" if db_healthy else "degraded",
        "database": "connected" if db_healthy else "disconnected"
    }


# =============================================================================
# Development Server Entry Point
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug
    )
