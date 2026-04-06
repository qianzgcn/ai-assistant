"""
Conversation API Endpoints

Handles all conversation-related HTTP endpoints.
"""

import logging
from typing import List

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse

from app.models.schemas import (
    Conversation,
    ConversationCreate,
    ConversationList,
    ConversationUpdate,
    SuccessResponse,
)
from app.services.chat_service import chat_service

# Configure logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/api/conversations", tags=["Conversations"])


@router.get(
    "",
    response_model=ConversationList,
    summary="List all conversations",
    description="Returns all conversations sorted by last update time (newest first)."
)
async def list_conversations() -> ConversationList:
    """
    List all conversations.
    
    Returns:
        ConversationList: List of conversations with total count
    """
    try:
        conversations = await chat_service.list_conversations()
        return ConversationList(
            conversations=conversations,
            total=len(conversations)
        )
    except Exception as e:
        logger.error(f"Failed to list conversations: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list conversations: {str(e)}"
        )


@router.post(
    "",
    response_model=Conversation,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new conversation",
    description="Creates a new conversation with optional title and model."
)
async def create_conversation(
    conversation: ConversationCreate = ConversationCreate()
) -> Conversation:
    """
    Create a new conversation.
    
    Args:
        conversation: Conversation creation data (title, model)
        
    Returns:
        Conversation: The newly created conversation
    """
    try:
        return await chat_service.create_conversation(
            title=conversation.title,
            model=conversation.model
        )
    except Exception as e:
        logger.error(f"Failed to create conversation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create conversation: {str(e)}"
        )


@router.get(
    "/{conversation_id}",
    response_model=Conversation,
    summary="Get a conversation",
    description="Returns a single conversation by ID."
)
async def get_conversation(conversation_id: str) -> Conversation:
    """
    Get a conversation by ID.
    
    Args:
        conversation_id: The conversation ID
        
    Returns:
        Conversation: The conversation
        
    Raises:
        HTTPException: If conversation not found
    """
    conversation = await chat_service.get_conversation(conversation_id)
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation {conversation_id} not found"
        )
    return conversation


@router.put(
    "/{conversation_id}",
    response_model=Conversation,
    summary="Update a conversation",
    description="Updates conversation metadata (title, model, status)."
)
async def update_conversation(
    conversation_id: str,
    update: ConversationUpdate
) -> Conversation:
    """
    Update a conversation.
    
    Args:
        conversation_id: The conversation ID
        update: Fields to update
        
    Returns:
        Conversation: The updated conversation
        
    Raises:
        HTTPException: If conversation not found
    """
    conversation = await chat_service.update_conversation(
        conversation_id,
        title=update.title,
        model=update.model,
        status=update.status
    )
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation {conversation_id} not found"
        )
    return conversation


@router.delete(
    "/{conversation_id}",
    response_model=SuccessResponse,
    summary="Delete a conversation",
    description="Deletes a conversation and all its messages."
)
async def delete_conversation(conversation_id: str) -> SuccessResponse:
    """
    Delete a conversation.
    
    Args:
        conversation_id: The conversation ID
        
    Returns:
        SuccessResponse: Confirmation of deletion
        
    Raises:
        HTTPException: If conversation not found
    """
    deleted = await chat_service.delete_conversation(conversation_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation {conversation_id} not found"
        )
    return SuccessResponse(message=f"Conversation {conversation_id} deleted")
