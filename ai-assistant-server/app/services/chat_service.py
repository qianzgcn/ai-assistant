"""
Chat Service

This module handles the core chat business logic:
- Conversation management (CRUD operations)
- Message processing and streaming
- Integration with OpenAI API
"""

import asyncio
import logging
import uuid
from datetime import datetime
from typing import AsyncGenerator, Dict, List, Optional

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_context
from app.models.models import ConversationModel, MessageModel
from app.models.schemas import (
    ChatMessage,
    Conversation,
    ConversationStatus,
    MessageRole,
    MessageStatus,
    StreamEvent,
    error_event,
    message_delta_event,
    message_end_event,
    message_start_event,
    title_generated_event,
)
from app.services.openai_service import OpenAIServiceError, openai_service

# Configure logging
logger = logging.getLogger(__name__)


class ChatService:
    """
    Service class for chat-related operations.
    
    Handles:
    - Conversation CRUD
    - Message persistence
    - OpenAI integration
    - Streaming response generation
    """
    
    # Active streams for cancellation
    _active_streams: Dict[str, asyncio.Event] = {}
    
    async def list_conversations(self) -> List[Conversation]:
        """
        List all conversations, sorted by last update time.
        
        Returns:
            List of Conversation objects
        """
        async with get_db_context() as db:
            result = await db.execute(
                select(ConversationModel)
                .order_by(ConversationModel.updated_at.desc())
            )
            models = result.scalars().all()
            
            return [
                Conversation(
                    id=m.id,
                    title=m.title,
                    model=m.model,
                    created_at=m.created_at,
                    updated_at=m.updated_at,
                    last_message_at=m.last_message_at,
                    status=m.status
                )
                for m in models
            ]
    
    async def get_conversation(self, conversation_id: str) -> Optional[Conversation]:
        """
        Get a single conversation by ID.
        
        Args:
            conversation_id: The conversation ID
            
        Returns:
            Conversation object or None if not found
        """
        async with get_db_context() as db:
            result = await db.execute(
                select(ConversationModel).where(ConversationModel.id == conversation_id)
            )
            model = result.scalar_one_or_none()
            
            if not model:
                return None
            
            return Conversation(
                id=model.id,
                title=model.title,
                model=model.model,
                created_at=model.created_at,
                updated_at=model.updated_at,
                last_message_at=model.last_message_at,
                status=model.status
            )
    
    async def create_conversation(
        self,
        title: str = "新会话",
        model: str = "gpt-4o-mini"
    ) -> Conversation:
        """
        Create a new conversation.
        
        Args:
            title: Initial conversation title
            model: AI model to use
            
        Returns:
            The newly created Conversation
        """
        now = datetime.utcnow()
        conversation = ConversationModel(
            id=str(uuid.uuid4()),
            title=title,
            model=model,
            status=ConversationStatus.IDLE,
            created_at=now,
            updated_at=now,
            last_message_at=now
        )
        
        async with get_db_context() as db:
            db.add(conversation)
        
        return Conversation(
            id=conversation.id,
            title=conversation.title,
            model=conversation.model,
            created_at=conversation.created_at,
            updated_at=conversation.updated_at,
            last_message_at=conversation.last_message_at,
            status=conversation.status
        )
    
    async def update_conversation(
        self,
        conversation_id: str,
        title: Optional[str] = None,
        model: Optional[str] = None,
        status: Optional[ConversationStatus] = None
    ) -> Optional[Conversation]:
        """
        Update conversation metadata.
        
        Args:
            conversation_id: The conversation ID
            title: New title (optional)
            model: New model (optional)
            status: New status (optional)
            
        Returns:
            Updated Conversation or None if not found
        """
        async with get_db_context() as db:
            result = await db.execute(
                select(ConversationModel).where(ConversationModel.id == conversation_id)
            )
            model_db = result.scalar_one_or_none()
            
            if not model_db:
                return None
            
            if title is not None:
                model_db.title = title
            if model is not None:
                model_db.model = model
            if status is not None:
                model_db.status = status
            
            model_db.updated_at = datetime.utcnow()
            
            return Conversation(
                id=model_db.id,
                title=model_db.title,
                model=model_db.model,
                created_at=model_db.created_at,
                updated_at=model_db.updated_at,
                last_message_at=model_db.last_message_at,
                status=model_db.status
            )
    
    async def delete_conversation(self, conversation_id: str) -> bool:
        """
        Delete a conversation and all its messages.
        
        Args:
            conversation_id: The conversation ID
            
        Returns:
            True if deleted, False if not found
        """
        async with get_db_context() as db:
            # Delete messages first (cascade should handle this, but be explicit)
            await db.execute(
                delete(MessageModel).where(
                    MessageModel.conversation_id == conversation_id
                )
            )
            
            # Delete conversation
            result = await db.execute(
                delete(ConversationModel).where(
                    ConversationModel.id == conversation_id
                )
            )
            
            return result.rowcount > 0
    
    async def get_conversation_messages(
        self,
        conversation_id: str
    ) -> List[ChatMessage]:
        """
        Get all messages for a conversation.
        
        Args:
            conversation_id: The conversation ID
            
        Returns:
            List of ChatMessage objects
        """
        async with get_db_context() as db:
            result = await db.execute(
                select(MessageModel)
                .where(MessageModel.conversation_id == conversation_id)
                .order_by(MessageModel.created_at.asc())
            )
            models = result.scalars().all()
            
            return [
                ChatMessage(
                    id=m.id,
                    conversation_id=m.conversation_id,
                    role=m.role,
                    content=m.content,
                    created_at=m.created_at,
                    status=m.status,
                    error=m.error
                )
                for m in models
            ]
    
    async def save_message(self, message: ChatMessage, conversation_id: str = None) -> None:
        """
        Save a single message to the database.
        
        Args:
            message: The ChatMessage to save
            conversation_id: Optional conversation ID override
        """
        now = datetime.utcnow()
        # Use provided conversation_id or fall back to message's conversation_id
        msg_conversation_id = conversation_id or getattr(message, 'conversation_id', None)
        message_model = MessageModel(
            id=message.id,
            conversation_id=msg_conversation_id,
            role=message.role,
            content=message.content,
            status=message.status,
            error=getattr(message, 'error', None),
            created_at=now
        )
        
        async with get_db_context() as db:
            db.add(message_model)
    
    async def update_message_content(
        self,
        message_id: str,
        content: str,
        status: MessageStatus = MessageStatus.COMPLETED
    ) -> None:
        """
        Update a message's content (used for streaming).
        
        Args:
            message_id: The message ID
            content: New content
            status: New status
        """
        async with get_db_context() as db:
            result = await db.execute(
                select(MessageModel).where(MessageModel.id == message_id)
            )
            message_model = result.scalar_one_or_none()
            
            if message_model:
                message_model.content = content
                message_model.status = status
                if status == MessageStatus.ERROR:
                    message_model.error = "Stream generation failed"
    
    async def stream_chat(
        self,
        conversation: Conversation,
        history: List[ChatMessage],
        user_message: ChatMessage,
        assistant_message_id: str,
        model: str,
        should_generate_title: bool = False
    ) -> AsyncGenerator[StreamEvent, None]:
        """
        Process a chat message and stream the response.
        
        This is the main method for handling chat interactions.
        It:
        1. Saves the user message
        2. Updates conversation status
        3. Streams the AI response
        4. Saves the assistant message
        5. Updates conversation timestamps
        
        Args:
            conversation: The current conversation
            history: Previous messages in the conversation
            user_message: The new user message
            assistant_message_id: ID for the assistant's response
            model: AI model to use
            should_generate_title: Whether to generate a title
            
        Yields:
            StreamEvent objects for SSE
        """
        # Create cancel event for this stream
        cancel_event = asyncio.Event()
        self._active_streams[conversation.id] = cancel_event
        
        try:
            # 1. Save user message
            await self.save_message(user_message, conversation_id=conversation.id)
            
            # 2. Update conversation status
            await self.update_conversation(
                conversation.id,
                status=ConversationStatus.GENERATING
            )
            
            # 3. Send message start event
            yield message_start_event(
                conversation_id=conversation.id,
                message_id=assistant_message_id
            )
            
            # 4. Generate title if requested
            if should_generate_title:
                title = await openai_service.generate_title(
                    user_message.content,
                    model
                )
                await self.update_conversation(conversation.id, title=title)
                yield title_generated_event(
                    conversation_id=conversation.id,
                    title=title
                )
            
            # 5. Prepare messages for OpenAI
            messages = openai_service.format_messages_for_openai(history + [user_message])
            
            # 6. Stream response from OpenAI
            full_content = ""
            error_occurred = False
            
            try:
                async for chunk in openai_service.chat_completion_stream(
                    messages=messages,
                    model=model
                ):
                    # Check for cancellation
                    if cancel_event.is_set():
                        logger.info(f"Stream cancelled for conversation {conversation.id}")
                        break
                    
                    full_content += chunk
                    yield message_delta_event(
                        conversation_id=conversation.id,
                        message_id=assistant_message_id,
                        delta=chunk
                    )
                    
            except OpenAIServiceError as e:
                error_occurred = True
                logger.error(f"OpenAI error: {e}")
                yield error_event(
                    conversation_id=conversation.id,
                    message_id=assistant_message_id,
                    error=str(e)
                )
            
            # 7. Send message end event
            if not error_occurred:
                yield message_end_event(
                    conversation_id=conversation.id,
                    message_id=assistant_message_id,
                    content=full_content
                )
                
                # Save assistant message
                assistant_message = ChatMessage(
                    id=assistant_message_id,
                    conversation_id=conversation.id,
                    role=MessageRole.ASSISTANT,
                    content=full_content,
                    created_at=datetime.utcnow(),
                    status=MessageStatus.COMPLETED
                )
                await self.save_message(assistant_message)
            else:
                # Save error message
                assistant_message = ChatMessage(
                    id=assistant_message_id,
                    conversation_id=conversation.id,
                    role=MessageRole.ASSISTANT,
                    content=full_content,
                    created_at=datetime.utcnow(),
                    status=MessageStatus.ERROR,
                    error="Failed to generate response"
                )
                await self.save_message(assistant_message)
            
            # 8. Update conversation status and timestamps
            await self.update_conversation(
                conversation.id,
                status=ConversationStatus.IDLE
            )
            
        finally:
            # Cleanup
            self._active_streams.pop(conversation.id, None)
    
    def stop_stream(self, conversation_id: str) -> bool:
        """
        Stop an active stream for a conversation.
        
        Args:
            conversation_id: The conversation ID
            
        Returns:
            True if stream was stopped, False if no active stream
        """
        cancel_event = self._active_streams.get(conversation_id)
        if cancel_event:
            cancel_event.set()
            return True
        return False


# Global service instance
chat_service = ChatService()
