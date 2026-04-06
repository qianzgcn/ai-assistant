"""
Model Configuration API Endpoints

Handles model-related HTTP endpoints.
"""

import logging

from fastapi import APIRouter

from app.core.config import settings
from app.models.schemas import ModelInfo, ModelListResponse

# Configure logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/api/models", tags=["Models"])


@router.get(
    "",
    response_model=ModelListResponse,
    summary="List available models",
    description="Returns a list of available AI models that can be used for chat."
)
async def list_models() -> ModelListResponse:
    """
    List all available AI models.
    
    Returns models configured in the server settings.
    The default model is determined by OPENAI_DEFAULT_MODEL env var.
    
    Returns:
        ModelListResponse: List of available models
    """
    models = [
        ModelInfo(
            id=m["id"],
            name=m["name"],
            description=m["description"],
            enabled=True
        )
        for m in settings.models_config
    ]
    
    return ModelListResponse(models=models)


@router.get(
    "/health",
    summary="Check service health",
    description="Check if the AI service is properly configured and responding."
)
async def health_check():
    """
    Check if the AI service is healthy.
    
    Verifies that the OpenAI API key is configured
    and the service can make requests.
    
    Returns:
        dict: Health status
    """
    from app.services.openai_service import openai_service
    
    if openai_service.is_configured():
        return {
            "status": "healthy",
            "configured": True,
            "default_model": settings.openai_default_model
        }
    else:
        return {
            "status": "unhealthy",
            "configured": False,
            "message": "OpenAI API key not configured"
        }
