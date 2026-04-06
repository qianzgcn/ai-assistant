"""
Chat API Endpoints

Handles chat-related HTTP endpoints including streaming responses.
"""

import asyncio
import json
import logging
from typing import AsyncGenerator

from fastapi import APIRouter, HTTPException, status
from sse_starlette.sse import EventSourceResponse

from app.models.schemas import (
    ChatMessage,
    Conversation,
    RegenerateRequest,
    SendMessageRequest,
    StreamEvent,
    format_stream_event,
)
from app.services.chat_service import chat_service

# Configure logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/api/chat", tags=["Chat"])


async def event_generator(
    conversation: Conversation,
    history: list,
    user_message: ChatMessage,
    assistant_message_id: str,
    model: str,
    should_generate_title: bool
) -> AsyncGenerator[str, None]:
    """
    Generate SSE events for streaming response.
    
    This is an async generator that yields properly formatted
    Server-Sent Events (SSE) for the client.
    
    Args:
        conversation: Current conversation
        history: Chat history
        user_message: User's message
        assistant_message_id: ID for assistant response
        model: AI model
        should_generate_title: Whether to generate title
        
    Yields:
        Formatted SSE strings
    """
    try:
        async for event in chat_service.stream_chat(
            conversation=conversation,
            history=history,
            user_message=user_message,
            assistant_message_id=assistant_message_id,
            model=model,
            should_generate_title=should_generate_title
        ):
            yield format_stream_event(event)
    except Exception as e:
        logger.error(f"Error in event generator: {e}")
        error_event = StreamEvent(
            type="error",
            conversation_id=conversation.id,
            error=f"Internal error: {str(e)}"
        )
        yield format_stream_event(error_event)


@router.post(
    "/stream",
    summary="Send message and stream response",
    description="Sends a chat message and streams the AI response using Server-Sent Events (SSE)."
)
async def send_message_stream(request: SendMessageRequest):
    """
    Send a chat message and receive a streaming response.
    
    This endpoint uses Server-Sent Events (SSE) to stream
    the AI response in real-time.
    
    The client should:
    1. Send a POST request with the message data
    2. Set Accept: text/event-stream header
    3. Parse SSE events from the response
    
    Events sent:
    - message_start: When assistant starts generating
    - title_generated: If title was generated
    - message_delta: Each chunk of the response
    - message_end: When response is complete
    - error: If an error occurred
    
    Args:
        request: SendMessageRequest with conversation, history, and user message
        
    Returns:
        EventSourceResponse: SSE stream
    """
    # Validate request
    if not request.user_message.content.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message content cannot be empty"
        )
    
    logger.info(
        f"Chat request: conversation={request.conversation.id}, "
        f"model={request.model}, "
        f"history_len={len(request.history)}"
    )
    
    # Create event generator
    generator = event_generator(
        conversation=request.conversation,
        history=request.history,
        user_message=request.user_message,
        assistant_message_id=request.assistant_message_id,
        model=request.model,
        should_generate_title=request.should_generate_title
    )
    
    return EventSourceResponse(generator)


@router.post(
    "/regenerate",
    summary="Regenerate last response",
    description="Regenerates the last AI response in the conversation."
)
async def regenerate_response(request: RegenerateRequest):
    """
    Regenerate the last AI response.
    
    This is similar to send_message_stream but uses the
    base_user_message to regenerate the last assistant response.
    
    Args:
        request: RegenerateRequest with conversation and history
        
    Returns:
        EventSourceResponse: SSE stream
    """
    logger.info(
        f"Regenerate request: conversation={request.conversation.id}, "
        f"model={request.model}"
    )
    
    # Use the same event generator logic
    generator = event_generator(
        conversation=request.conversation,
        history=request.history,
        user_message=request.base_user_message,
        assistant_message_id=request.assistant_message_id,
        model=request.model,
        should_generate_title=False
    )
    
    return EventSourceResponse(generator)


@router.post(
    "/stop/{conversation_id}",
    summary="Stop streaming",
    description="Stops the active streaming for a conversation."
)
async def stop_streaming(conversation_id: str):
    """
    Stop an active streaming response.
    
    This endpoint allows the client to cancel an ongoing
    streaming response.
    
    Args:
        conversation_id: The conversation ID
        
    Returns:
        dict: Confirmation message
    """
    stopped = chat_service.stop_stream(conversation_id)
    
    if stopped:
        logger.info(f"Stream stopped for conversation {conversation_id}")
        return {"success": True, "message": "Stream stopped"}
    else:
        logger.info(f"No active stream for conversation {conversation_id}")
        return {"success": False, "message": "No active stream found"}
