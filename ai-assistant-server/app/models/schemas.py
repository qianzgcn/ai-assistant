"""
Pydantic Models / Schemas

This module defines all data validation models using Pydantic.
These models are used for:
- Request body validation
- Response serialization
- API documentation (OpenAPI/Swagger)
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, Field, field_validator


# =============================================================================
# Enums
# =============================================================================

class ConversationStatus(str, Enum):
    """Status of a conversation."""
    IDLE = "idle"
    GENERATING = "generating"
    ERROR = "error"


class MessageStatus(str, Enum):
    """Status of a message."""
    PENDING = "pending"
    STREAMING = "streaming"
    COMPLETED = "completed"
    STOPPED = "stopped"
    ERROR = "error"


class MessageRole(str, Enum):
    """Role of a message sender."""
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


# =============================================================================
# Conversation Models
# =============================================================================

class ConversationBase(BaseModel):
    """Base conversation model with common fields."""
    title: str = Field(default="新会话", description="Conversation title")
    model: str = Field(default="gpt-4o-mini", description="AI model to use")


class ConversationCreate(ConversationBase):
    """Model for creating a new conversation."""
    pass


class ConversationUpdate(BaseModel):
    """Model for updating conversation metadata."""
    title: Optional[str] = None
    model: Optional[str] = None
    status: Optional[ConversationStatus] = None


class Conversation(ConversationBase):
    """Full conversation model with all fields."""
    id: str = Field(description="Unique conversation identifier")
    created_at: datetime = Field(description="Creation timestamp")
    updated_at: datetime = Field(description="Last update timestamp")
    last_message_at: datetime = Field(description="Last message timestamp")
    status: ConversationStatus = Field(default=ConversationStatus.IDLE)

    model_config = {"from_attributes": True}


class ConversationList(BaseModel):
    """Response model for listing conversations."""
    conversations: List[Conversation]
    total: int


# =============================================================================
# Message Models
# =============================================================================

class MessageBase(BaseModel):
    """Base message model with common fields."""
    role: MessageRole
    content: str = ""


class MessageCreate(MessageBase):
    """Model for creating a new message."""
    conversation_id: str


class Message(MessageBase):
    """Full message model with all fields."""
    id: str = Field(description="Unique message identifier")
    conversation_id: str = Field(description="Parent conversation ID")
    created_at: datetime = Field(description="Creation timestamp")
    status: MessageStatus = Field(default=MessageStatus.PENDING)
    error: Optional[str] = None

    model_config = {"from_attributes": True}


# =============================================================================
# Chat Request/Response Models
# =============================================================================

class ChatMessage(BaseModel):
    """
    Chat message in request/response.
    
    Represents a single message in the chat history.
    """
    id: str = Field(description="Unique message identifier")
    role: MessageRole
    content: str = ""
    status: MessageStatus = MessageStatus.COMPLETED
    error: Optional[str] = None


class SendMessageRequest(BaseModel):
    """
    Request model for sending a chat message.
    
    Contains all information needed to generate a response.
    """
    conversation: Conversation
    history: List[ChatMessage] = Field(default_factory=list)
    user_message: ChatMessage
    assistant_message_id: str
    model: str = "gpt-4o-mini"
    should_generate_title: bool = False

    @field_validator('history', mode='before')
    @classmethod
    def validate_history(cls, v):
        """Ensure history is a list."""
        if v is None:
            return []
        return v


class RegenerateRequest(BaseModel):
    """
    Request model for regenerating the last AI response.
    """
    conversation: Conversation
    history: List[ChatMessage] = Field(default_factory=list)
    base_user_message: ChatMessage
    assistant_message_id: str
    model: str = "gpt-4o-mini"

    @field_validator('history', mode='before')
    @classmethod
    def validate_history(cls, v):
        """Ensure history is a list."""
        if v is None:
            return []
        return v


# =============================================================================
# Stream Event Models
# =============================================================================

class StreamEvent(BaseModel):
    """
    Server-Sent Event (SSE) model for streaming responses.
    
    Each event has a 'type' field indicating what kind of data
    is being sent.
    """
    type: str
    conversation_id: Optional[str] = None
    message_id: Optional[str] = None
    delta: Optional[str] = None
    content: Optional[str] = None
    title: Optional[str] = None
    error: Optional[str] = None
    done: Optional[bool] = None


def message_start_event(
    conversation_id: str,
    message_id: str
) -> StreamEvent:
    """Create a message_start event."""
    return StreamEvent(
        type="message_start",
        conversation_id=conversation_id,
        message_id=message_id
    )


def message_delta_event(
    conversation_id: str,
    message_id: str,
    delta: str
) -> StreamEvent:
    """Create a message_delta event."""
    return StreamEvent(
        type="message_delta",
        conversation_id=conversation_id,
        message_id=message_id,
        delta=delta
    )


def message_end_event(
    conversation_id: str,
    message_id: str,
    content: str
) -> StreamEvent:
    """Create a message_end event."""
    return StreamEvent(
        type="message_end",
        conversation_id=conversation_id,
        message_id=message_id,
        content=content,
        done=True
    )


def title_generated_event(
    conversation_id: str,
    title: str
) -> StreamEvent:
    """Create a title_generated event."""
    return StreamEvent(
        type="title_generated",
        conversation_id=conversation_id,
        title=title
    )


def error_event(
    conversation_id: str,
    message_id: str,
    error: str
) -> StreamEvent:
    """Create an error event."""
    return StreamEvent(
        type="error",
        conversation_id=conversation_id,
        message_id=message_id,
        error=error
    )


# =============================================================================
# Model Configuration
# =============================================================================

class ModelInfo(BaseModel):
    """Information about an available AI model."""
    id: str
    name: str
    description: str
    enabled: bool = True


class ModelListResponse(BaseModel):
    """Response model for listing available models."""
    models: List[ModelInfo]


# =============================================================================
# Generic Response Models
# =============================================================================

class SuccessResponse(BaseModel):
    """Generic success response."""
    success: bool = True
    message: str = "Operation completed successfully"


class ErrorResponse(BaseModel):
    """Generic error response."""
    success: bool = False
    error: str
    detail: Optional[str] = None


class ChatSnapshot(BaseModel):
    """
    Full chat snapshot for loading persisted data.
    
    Contains all conversations and their messages.
    """
    conversations: List[Conversation] = Field(default_factory=list)
    messages_by_conversation: Dict[str, List[ChatMessage]] = Field(default_factory=dict)


# =============================================================================
# Utility Functions
# =============================================================================

def format_stream_event(event: StreamEvent) -> str:
    """
    Format a StreamEvent as a Server-Sent Events (SSE) string.
    
    Args:
        event: The stream event to format
        
    Returns:
        A properly formatted SSE string
    """
    data = event.model_dump(exclude_none=True)
    return f"data: {data}\n\n"
