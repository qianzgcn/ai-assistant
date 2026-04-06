"""
SQLAlchemy Database Models

These models define the database schema for persistent storage
of conversations and messages.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Column, String, DateTime, Text, Enum, ForeignKey, Index, JSON
)
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.schemas import ConversationStatus, MessageRole, MessageStatus


class ConversationModel(Base):
    """
    Database model for conversations.
    
    Stores metadata about each chat conversation.
    """
    __tablename__ = "conversations"
    
    # Primary key
    id = Column(String(36), primary_key=True, index=True)
    
    # Conversation metadata
    title = Column(String(255), default="新会话", nullable=False)
    model = Column(String(100), default="gpt-4o-mini", nullable=False)
    status = Column(
        Enum(ConversationStatus),
        default=ConversationStatus.IDLE,
        nullable=False
    )
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    last_message_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Schema version for migrations
    schema_version = Column(JSON, default={"version": 1})
    
    # Relationship to messages
    messages = relationship(
        "MessageModel",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="MessageModel.created_at"
    )
    
    def __repr__(self) -> str:
        return f"<Conversation(id={self.id}, title='{self.title}')>"
    
    @classmethod
    def from_schema(cls, **kwargs) -> "ConversationModel":
        """Create instance from Pydantic schema."""
        return cls(**kwargs)


class MessageModel(Base):
    """
    Database model for messages.
    
    Stores individual messages within conversations.
    """
    __tablename__ = "messages"
    
    # Primary key
    id = Column(String(36), primary_key=True, index=True)
    
    # Foreign key to parent conversation
    conversation_id = Column(
        String(36),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Message content
    role = Column(Enum(MessageRole), nullable=False)
    content = Column(Text, default="", nullable=False)
    
    # Status
    status = Column(
        Enum(MessageStatus),
        default=MessageStatus.COMPLETED,
        nullable=False
    )
    error = Column(Text, nullable=True)
    
    # Timestamp
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Schema version for migrations
    schema_version = Column(JSON, default={"version": 1})
    
    # Relationship to conversation
    conversation = relationship("ConversationModel", back_populates="messages")
    
    # Index for efficient queries
    __table_args__ = (
        Index("idx_messages_conversation_created", "conversation_id", "created_at"),
    )
    
    def __repr__(self) -> str:
        return f"<Message(id={self.id}, role={self.role})>"
    
    @classmethod
    def from_schema(cls, **kwargs) -> "MessageModel":
        """Create instance from Pydantic schema."""
        return cls(**kwargs)
