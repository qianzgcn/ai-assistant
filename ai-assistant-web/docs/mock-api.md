# Mock API 设计

## 1. ChatService 接口

```ts
interface ChatService {
  listConversations(): Promise<Conversation[]>;
  createConversation(conversation: Conversation): Promise<Conversation>;
  updateConversationMeta(conversation: Conversation): Promise<Conversation>;
  deleteConversation(conversationId: string): Promise<void>;
  sendMessageStream(request: SendMessageStreamRequest): AsyncGenerator<ChatStreamEvent>;
  regenerateLastAnswer(request: RegenerateAnswerRequest): AsyncGenerator<ChatStreamEvent>;
  stopStreaming(conversationId: string): void;
}
```

## 2. 流式事件

```ts
type ChatStreamEvent =
  | { type: 'message_start'; conversationId: string; messageId: string }
  | { type: 'message_delta'; conversationId: string; messageId: string; delta: string }
  | { type: 'message_end'; conversationId: string; messageId: string; content: string; done: true }
  | { type: 'title_generated'; conversationId: string; title: string }
  | { type: 'error'; conversationId: string; messageId: string; error: string };
```

## 3. Mock 规则
- 首条用户消息触发自动建会话与标题生成
- 响应按句子或固定分片逐步返回，模拟真实流式延迟
- `stopStreaming(conversationId)` 通过 `AbortController` 停止输出
- 用户消息包含 `[mock-error]` 时，主动返回错误事件

## 4. 接真实后端的建议
- 将 `sendMessageStream` 映射到 OpenAI 兼容 SSE
- 保留前端的归一化事件层，避免 UI 直接依赖后端原始包格式
- 让会话元数据接口和消息流接口解耦，后续更容易替换模型服务或网关
