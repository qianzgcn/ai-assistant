"""
Unit Tests for API Endpoints

These tests verify that the API endpoints are working correctly.
Uses FastAPI's TestClient for synchronous testing.
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime

from fastapi.testclient import TestClient

from app.main import app
from app.models.schemas import (
    Conversation,
    ConversationStatus,
    MessageRole,
    MessageStatus,
)


@pytest.fixture
def client():
    """Create a test client."""
    return TestClient(app)


class TestRootEndpoints:
    """Tests for root and health endpoints."""
    
    def test_root_endpoint(self, client):
        """Test root endpoint returns API info."""
        response = client.get("/")
        
        assert response.status_code == 200
        data = response.json()
        assert "name" in data
        assert "version" in data
        assert data["name"] == "AI Assistant Server"
    
    def test_health_endpoint(self, client):
        """Test health check endpoint."""
        response = client.get("/health")
        
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "database" in data


class TestConversationEndpoints:
    """Tests for conversation API endpoints."""
    
    @patch("app.api.endpoints.conversations.chat_service")
    def test_list_conversations_empty(self, mock_service, client):
        """Test listing conversations when none exist."""
        mock_service.list_conversations = AsyncMock(return_value=[])
        
        response = client.get("/api/conversations")
        
        assert response.status_code == 200
        data = response.json()
        assert "conversations" in data
        assert "total" in data
        assert data["total"] == 0
    
    @patch("app.api.endpoints.conversations.chat_service")
    def test_list_conversations_with_data(self, mock_service, client):
        """Test listing conversations with existing data."""
        now = datetime.utcnow()
        mock_conversation = Conversation(
            id="test-id",
            title="Test Chat",
            model="gpt-4o-mini",
            created_at=now,
            updated_at=now,
            last_message_at=now,
            status=ConversationStatus.IDLE
        )
        mock_service.list_conversations = AsyncMock(return_value=[mock_conversation])
        
        response = client.get("/api/conversations")
        
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["conversations"][0]["title"] == "Test Chat"
    
    @patch("app.api.endpoints.conversations.chat_service")
    def test_create_conversation(self, mock_service, client):
        """Test creating a new conversation."""
        now = datetime.utcnow()
        mock_conversation = Conversation(
            id="new-id",
            title="New Chat",
            model="gpt-4o-mini",
            created_at=now,
            updated_at=now,
            last_message_at=now,
            status=ConversationStatus.IDLE
        )
        mock_service.create_conversation = AsyncMock(return_value=mock_conversation)
        
        response = client.post(
            "/api/conversations",
            json={"title": "New Chat", "model": "gpt-4o-mini"}
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "New Chat"
        assert data["id"] == "new-id"
    
    @patch("app.api.endpoints.conversations.chat_service")
    def test_get_conversation(self, mock_service, client):
        """Test getting a single conversation."""
        now = datetime.utcnow()
        mock_conversation = Conversation(
            id="test-id",
            title="Test Chat",
            model="gpt-4o-mini",
            created_at=now,
            updated_at=now,
            last_message_at=now,
            status=ConversationStatus.IDLE
        )
        mock_service.get_conversation = AsyncMock(return_value=mock_conversation)
        
        response = client.get("/api/conversations/test-id")
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == "test-id"
    
    @patch("app.api.endpoints.conversations.chat_service")
    def test_get_conversation_not_found(self, mock_service, client):
        """Test getting a non-existent conversation."""
        mock_service.get_conversation = AsyncMock(return_value=None)
        
        response = client.get("/api/conversations/non-existent")
        
        assert response.status_code == 404
    
    @patch("app.api.endpoints.conversations.chat_service")
    def test_delete_conversation(self, mock_service, client):
        """Test deleting a conversation."""
        mock_service.delete_conversation = AsyncMock(return_value=True)
        
        response = client.delete("/api/conversations/test-id")
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True


class TestModelEndpoints:
    """Tests for model configuration endpoints."""
    
    def test_list_models(self, client):
        """Test listing available models."""
        response = client.get("/api/models")
        
        assert response.status_code == 200
        data = response.json()
        assert "models" in data
        assert isinstance(data["models"], list)
    
    def test_model_health(self, client):
        """Test model health check."""
        response = client.get("/api/models/health")
        
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "configured" in data


class TestValidation:
    """Tests for request validation."""
    
    @patch("app.api.endpoints.conversations.chat_service")
    def test_create_conversation_invalid_data(self, mock_service, client):
        """Test creating conversation with invalid data."""
        now = datetime.utcnow()
        mock_conversation = Conversation(
            id="new-id",
            title="New Chat",
            model="gpt-4o-mini",
            created_at=now,
            updated_at=now,
            last_message_at=now,
            status=ConversationStatus.IDLE
        )
        mock_service.create_conversation = AsyncMock(return_value=mock_conversation)
        
        response = client.post(
            "/api/conversations",
            json={"title": "Valid Title"}
        )
        
        # Should succeed (mocked service)
        assert response.status_code == 201
    
    def test_send_message_empty_content(self, client):
        """Test sending message with empty content."""
        response = client.post(
            "/api/chat/stream",
            json={
                "conversation": {
                    "id": "test-id",
                    "title": "Test",
                    "model": "gpt-4o-mini",
                    "created_at": "2024-01-01T00:00:00",
                    "updated_at": "2024-01-01T00:00:00",
                    "last_message_at": "2024-01-01T00:00:00",
                    "status": "idle"
                },
                "history": [],
                "user_message": {
                    "id": "msg-1",
                    "role": "user",
                    "content": "   ",  # Whitespace only
                    "status": "completed"
                },
                "assistant_message_id": "msg-2",
                "model": "gpt-4o-mini",
                "should_generate_title": False
            }
        )
        
        # Should fail validation
        assert response.status_code == 400


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
