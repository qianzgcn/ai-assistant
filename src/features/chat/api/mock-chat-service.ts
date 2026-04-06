import type { ChatService } from '@/features/chat/api/chat-service';
import { chatRepository } from '@/features/chat/data/chat-repository';
import { buildConversationTitle } from '@/features/chat/lib/build-conversation-title';
import { DEFAULT_CONVERSATION_TITLE } from '@/features/chat/model/chat.constants';
import type {
  ChatStreamEvent,
  Conversation,
  RegenerateAnswerRequest,
  SendMessageStreamRequest,
} from '@/features/chat/model/chat.types';

function sleep(duration: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, duration);
  });
}

function createMockChunks(content: string) {
  return content
    .split(/(?<=[。！？\n])/)
    .flatMap((segment) => {
      if (segment.length <= 18) {
        return [segment];
      }

      return segment.match(/.{1,18}/g) ?? [segment];
    })
    .filter(Boolean);
}

function createMockReply(request: Pick<SendMessageStreamRequest, 'conversation' | 'history' | 'userMessage' | 'model'>) {
  const latestQuestion = request.userMessage.content.trim();
  const earlierUserMessage = request.history.filter((message) => message.role === 'user').at(-2)?.content;
  const lower = latestQuestion.toLowerCase();

  if (lower.includes('代码') || lower.includes('react') || lower.includes('typescript')) {
    return [
      `我会按 **${request.model}** 的 mock 风格来回答，并延续当前会话《${request.conversation.title || DEFAULT_CONVERSATION_TITLE}》的上下文。`,
      '',
      '可以先按下面这套方式组织实现：',
      '',
      '1. 先把领域模型与页面状态拆开，避免聊天页越来越难维护。',
      '2. 将流式输出过程只保留在内存态，结束后再写入持久化层。',
      '3. 对用户消息、助手消息和系统提示使用统一的数据结构，方便后续接真实接口。',
      '',
      '```tsx',
      'type ChatMessage = {',
      "  id: string;",
      "  role: 'user' | 'assistant' | 'system';",
      '  content: string;',
      '};',
      '',
      'function appendDelta(source: string, delta: string) {',
      '  return `${source}${delta}`;',
      '}',
      '```',
      '',
      earlierUserMessage
        ? `另外我注意到你前面还提到过：${earlierUserMessage.slice(0, 36)}，所以这次回复会默认沿用那个上下文。`
        : '如果你愿意，我下一条可以继续把这部分细化成可直接落代码的模块清单。',
    ].join('\n');
  }

  if (lower.includes('对比') || lower.includes('比较')) {
    return [
      `下面给你一个简洁对比，当前使用模型是 **${request.model}**。`,
      '',
      '| 维度 | 方案 A | 方案 B |',
      '| --- | --- | --- |',
      '| 开发速度 | 更快 | 更灵活 |',
      '| 后续扩展 | 中等 | 更强 |',
      '| 首版复杂度 | 更低 | 更高 |',
      '',
      '建议首版先选实现路径更短、后续又方便替换的一侧。',
    ].join('\n');
  }

  if (lower.includes('总结') || lower.includes('方案') || lower.includes('计划')) {
    return [
      `我基于这轮输入整理了一个更偏执行的回答，模型占位为 **${request.model}**。`,
      '',
      '## 结论',
      '优先保证主链路完整：多会话、流式回复、本地持久化、错误处理。',
      '',
      '## 下一步',
      '- 先把 UI 和 mock 服务跑通。',
      '- 再补测试与真实后端适配层。',
      '- 最后做细节体验，例如重命名、搜索与重新生成。',
    ].join('\n');
  }

  return [
    `收到，我会继续围绕“${latestQuestion || '当前问题'}”往下展开。`,
    '',
    '这是一段模拟真实大模型流式输出的回复，所以你会看到内容被逐步拼接出来。',
    '',
    '我会默认给出：',
    '- 一个直接可执行的建议',
    '- 一个更稳妥的工程做法',
    '- 一个便于后续接真实后端的接口思路',
    '',
    earlierUserMessage
      ? `顺带一提，我记得你前面提到过“${earlierUserMessage.slice(0, 28)}”，这次我会把它视作同一条上下文。`
      : '如果你继续追问，我会沿着当前会话上下文继续回答，而不是重开一条新的思路。',
  ].join('\n');
}

function throwIfAborted(signal: AbortSignal) {
  if (signal.aborted) {
    throw new DOMException('流式输出已被手动停止。', 'AbortError');
  }
}

class MockChatService implements ChatService {
  private readonly abortControllers = new Map<string, AbortController>();

  async listConversations() {
    const snapshot = await chatRepository.loadSnapshot();
    return snapshot.conversations;
  }

  async createConversation(conversation: Conversation) {
    await chatRepository.saveConversation(conversation);
    return conversation;
  }

  async updateConversationMeta(conversation: Conversation) {
    await chatRepository.saveConversation(conversation);
    return conversation;
  }

  async deleteConversation(conversationId: string) {
    await chatRepository.deleteConversation(conversationId);
  }

  async *sendMessageStream(request: SendMessageStreamRequest): AsyncGenerator<ChatStreamEvent, void, void> {
    yield* this.runStream(request);
  }

  async *regenerateLastAnswer(
    request: RegenerateAnswerRequest,
  ): AsyncGenerator<ChatStreamEvent, void, void> {
    yield* this.runStream({
      ...request,
      userMessage: request.baseUserMessage,
    });
  }

  stopStreaming(conversationId: string) {
    this.abortControllers.get(conversationId)?.abort();
  }

  private async *runStream(request: SendMessageStreamRequest): AsyncGenerator<ChatStreamEvent, void, void> {
    const controller = new AbortController();
    this.abortControllers.set(request.conversation.id, controller);

    try {
      yield {
        type: 'message_start',
        conversationId: request.conversation.id,
        messageId: request.assistantMessageId,
      };

      if (request.shouldGenerateTitle) {
        await sleep(120);
        throwIfAborted(controller.signal);
        yield {
          type: 'title_generated',
          conversationId: request.conversation.id,
          title: buildConversationTitle(request.userMessage.content),
        };
      }

      const finalContent = createMockReply(request);
      const chunks = createMockChunks(finalContent);

      for (const chunk of chunks) {
        throwIfAborted(controller.signal);
        await sleep(110 + Math.round(Math.random() * 140));
        throwIfAborted(controller.signal);

        yield {
          type: 'message_delta',
          conversationId: request.conversation.id,
          messageId: request.assistantMessageId,
          delta: chunk,
        };
      }

      if (request.userMessage.content.includes('[mock-error]')) {
        yield {
          type: 'error',
          conversationId: request.conversation.id,
          messageId: request.assistantMessageId,
          error: '已按约定注入 mock 错误，请检查前端错误态与重试逻辑。',
        };
        return;
      }

      yield {
        type: 'message_end',
        conversationId: request.conversation.id,
        messageId: request.assistantMessageId,
        content: finalContent,
        done: true,
      };
    } finally {
      const current = this.abortControllers.get(request.conversation.id);
      if (current === controller) {
        this.abortControllers.delete(request.conversation.id);
      }
    }
  }
}

export const mockChatService = new MockChatService();
