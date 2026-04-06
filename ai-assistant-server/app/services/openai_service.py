"""
OpenAI API Service

This module handles all communication with the OpenAI API.
Supports streaming responses and various AI models.
"""

import asyncio
import logging
import re
from typing import AsyncGenerator, Dict, List, Optional

from openai import AsyncOpenAI, APIError, RateLimitError, Timeout
from openai.types.chat import ChatCompletionChunk

from app.core.config import settings
from app.models.schemas import ChatMessage, MessageRole

# Configure logging
logger = logging.getLogger(__name__)


class OpenAIServiceError(Exception):
    """Custom exception for OpenAI service errors."""
    pass


class OpenAIService:
    """
    Service class for interacting with OpenAI API.
    
    Handles:
    - Client initialization
    - Streaming chat completions
    - Error handling and retry logic
    """
    
    def __init__(self):
        """Initialize the OpenAI service."""
        self._client: Optional[AsyncOpenAI] = None
        self._initialized = False
    
    @property
    def client(self) -> AsyncOpenAI:
        """Get or create the async OpenAI client."""
        if not self._initialized:
            self._client = AsyncOpenAI(
                api_key=settings.openai_api_key,
                base_url=settings.openai_base_url,
                timeout=60.0,  # 60 second timeout
                max_retries=3,
            )
            self._initialized = True
        return self._client
    
    def is_configured(self) -> bool:
        """Check if the service is properly configured."""
        return bool(settings.openai_api_key)
    
    async def chat_completion_stream(
        self,
        messages: List[Dict],
        model: str = "gpt-4o-mini",
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> AsyncGenerator[str, None]:
        """
        Generate a streaming chat completion.
        
        Args:
            messages: List of message dictionaries with 'role' and 'content'
            model: Model identifier
            temperature: Sampling temperature (0-2)
            max_tokens: Maximum tokens to generate
            
        Yields:
            String chunks of the response
            
        Raises:
            OpenAIServiceError: If API call fails
        """
        if not self.is_configured():
            raise OpenAIServiceError("OpenAI API key not configured")
        
        try:
            stream = await self.client.chat.completions.create(
                model=model,
                messages=messages,
                stream=True,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            
            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    content = chunk.choices[0].delta.content
                    yield content
                    
        except RateLimitError as e:
            logger.warning(f"OpenAI rate limit exceeded: {e}")
            raise OpenAIServiceError(f"Rate limit exceeded. Please try again later. ({e})")
            
        except Timeout as e:
            logger.warning(f"OpenAI request timeout: {e}")
            raise OpenAIServiceError(f"Request timed out. Please try again. ({e})")
            
        except APIError as e:
            logger.error(f"OpenAI API error: {e}")
            raise OpenAIServiceError(f"OpenAI API error: {str(e)}")
            
        except Exception as e:
            logger.error(f"Unexpected error during OpenAI request: {e}")
            raise OpenAIServiceError(f"Unexpected error: {str(e)}")
    
    async def chat_completion(
        self,
        messages: List[Dict],
        model: str = "gpt-4o-mini",
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> str:
        """
        Generate a non-streaming chat completion.
        
        Args:
            messages: List of message dictionaries
            model: Model identifier
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate
            
        Returns:
            The complete response string
        """
        if not self.is_configured():
            raise OpenAIServiceError("OpenAI API key not configured")
        
        try:
            response = await self.client.chat.completions.create(
                model=model,
                messages=messages,
                stream=False,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            
            return response.choices[0].message.content or ""
            
        except Exception as e:
            logger.error(f"OpenAI chat completion error: {e}")
            raise OpenAIServiceError(f"Failed to get completion: {str(e)}")
    
    async def generate_title(
        self,
        user_message: str,
        model: str = "gpt-4o-mini",
    ) -> str:
        """
        Generate a conversation title from the user's message.
        
        Args:
            user_message: The first user message
            model: Model to use
            
        Returns:
            A short, descriptive title
        """
        system_prompt = """你是一个对话标题生成器。请根据用户的第一个问题生成一个简短（最多10个字）的标题。

要求：
1. 直接返回标题，不要加引号或任何解释
2. 标题应该简洁明了地概括用户的问题
3. 只返回中文标题

示例：
- 用户："帮我写一个Python函数" → 生成标题：Python函数编写
- 用户："如何学习英语" → 生成标题：英语学习方法
"""
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ]
        
        try:
            response = await self.chat_completion(messages, model)
            # Clean up the response
            title = response.strip().replace('"', '').replace('「', '').replace('」', '')
            # Truncate if too long
            if len(title) > 10:
                title = title[:10]
            return title or "新会话"
        except Exception as e:
            logger.warning(f"Failed to generate title: {e}")
            return "新会话"
    
    def format_messages_for_openai(
        self,
        history: List[ChatMessage],
    ) -> List[Dict[str, str]]:
        """
        Convert chat messages to OpenAI API format.
        
        Args:
            history: List of ChatMessage objects
            
        Returns:
            List of dictionaries with 'role' and 'content'
        """
        formatted = []
        for msg in history:
            formatted.append({
                "role": msg.role.value,
                "content": msg.content
            })
        return formatted


# Global service instance
openai_service = OpenAIService()
