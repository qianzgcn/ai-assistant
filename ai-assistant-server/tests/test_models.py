"""
Unit Tests for Chat Service Models and Schemas

These tests verify that the Pydantic models and schemas
are working correctly.
"""

import pytest
from datetime import datetime

from app.models.schemas import (
    ChatMessage,
    Conversation,
    ConversationStatus,
    ConversationCreate,
    MessageRole,
    MessageStatus,
    StreamEvent,
    format_stream_event,
    message_delta_event,
    message_end_event,
    message_start_event,
    title_generated_event,
    error_event,
)


class TestConversationModel:
    """Tests for Conversation model."""
    
    def test_conversation_default_values(self):
        """Test conversation with default values."""
        conv = Conversation(
            id="test-id",
            title="Test",
            model="gpt-4o-mini",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            last_message_at=datetime.utcnow()
        )
        
        assert conv.id == "test-id"
        assert conv.title == "Test"
        assert conv.status == ConversationStatus.IDLE
    
    def test_conversation_create_defaults(self):
        """Test ConversationCreate with defaults."""
        conv = ConversationCreate()
        
        assert conv.title == "新会话"
        assert conv.model == "gpt-4o-mini"
    
    def test_conversation_from_create(self):
        """Test creating Conversation from ConversationCreate."""
        create_data = ConversationCreate(title="My Chat", model="gpt-4o")
        now = datetime.utcnow()
        
        conv = Conversation(
            id="new-id",
            title=create_data.title,
            model=create_data.model,
            created_at=now,
            updated_at=now,
            last_message_at=now
        )
        
        assert conv.title == "My Chat"
        assert conv.model == "gpt-4o"


class TestChatMessageModel:
    """Tests for ChatMessage model."""
    
    def test_chat_message_creation(self):
        """Test creating a chat message."""
        msg = ChatMessage(
            id="msg-1",
            role=MessageRole.USER,
            content="Hello!",
            status=MessageStatus.COMPLETED
        )
        
        assert msg.id == "msg-1"
        assert msg.role == MessageRole.USER
        assert msg.content == "Hello!"
        assert msg.status == MessageStatus.COMPLETED
    
    def test_chat_message_defaults(self):
        """Test chat message default values."""
        msg = ChatMessage(
            id="msg-1",
            role=MessageRole.ASSISTANT
        )
        
        assert msg.content == ""
        assert msg.status == MessageStatus.COMPLETED


class TestStreamEvents:
    """Tests for streaming event factories."""
    
    def test_message_start_event(self):
        """Test message_start event creation."""
        event = message_start_event(
            conversation_id="conv-1",
            message_id="msg-1"
        )
        
        assert event.type == "message_start"
        assert event.conversation_id == "conv-1"
        assert event.message_id == "msg-1"
    
    def test_message_delta_event(self):
        """Test message_delta event creation."""
        event = message_delta_event(
            conversation_id="conv-1",
            message_id="msg-1",
            delta="Hello"
        )
        
        assert event.type == "message_delta"
        assert event.delta == "Hello"
    
    def test_message_end_event(self):
        """Test message_end event creation."""
        event = message_end_event(
            conversation_id="conv-1",
            message_id="msg-1",
            content="Full response"
        )
        
        assert event.type == "message_end"
        assert event.content == "Full response"
        assert event.done is True
    
    def test_title_generated_event(self):
        """Test title_generated event creation."""
        event = title_generated_event(
            conversation_id="conv-1",
            title="New Title"
        )
        
        assert event.type == "title_generated"
        assert event.title == "New Title"
    
    def test_error_event(self):
        """Test error event creation."""
        event = error_event(
            conversation_id="conv-1",
            message_id="msg-1",
            error="Something went wrong"
        )
        
        assert event.type == "error"
        assert event.error == "Something went wrong"
    
    def test_format_stream_event(self):
        """Test formatting stream event to SSE string."""
        event = message_start_event(
            conversation_id="conv-1",
            message_id="msg-1"
        )
        
        formatted = format_stream_event(event)
        
        assert "data:" in formatted
        assert "message_start" in formatted
        assert "conv-1" in formatted


class TestEnums:
    """Tests for enum types."""
    
    def test_conversation_status_values(self):
        """Test ConversationStatus enum values."""
        assert ConversationStatus.IDLE.value == "idle"
        assert ConversationStatus.GENERATING.value == "generating"
        assert ConversationStatus.ERROR.value == "error"
    
    def test_message_status_values(self):
        """Test MessageStatus enum values."""
        assert MessageStatus.PENDING.value == "pending"
        assert MessageStatus.STREAMING.value == "streaming"
        assert MessageStatus.COMPLETED.value == "completed"
        assert MessageStatus.STOPPED.value == "stopped"
        assert MessageStatus.ERROR.value == "error"
    
    def test_message_role_values(self):
        """Test MessageRole enum values."""
        assert MessageRole.USER.value == "user"
        assert MessageRole.ASSISTANT.value == "assistant"
        assert MessageRole.SYSTEM.value == "system"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
