import { useEffect, useEffectEvent, useRef } from 'react';

import Flex from 'antd/es/flex';
import Layout from 'antd/es/layout';
import Spin from 'antd/es/spin';

import {
  ChatComposer,
  ChatHeader,
  ChatMessageList,
  ChatWelcome,
  ConversationSidebar,
  useChatStore,
  useChatUiStore,
} from '@/features/chat';
import type { ChatMessage } from '@/features/chat';

import styles from '@/pages/chat/ChatPage.module.css';

const { Content, Sider } = Layout;
const EMPTY_MESSAGES: ChatMessage[] = [];

export function ChatPage() {
  const initialize = useChatStore((state) => state.initialize);
  const initialized = useChatStore((state) => state.initialized);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const conversations = useChatStore((state) => state.conversations);
  const messagesByConversation = useChatStore((state) => state.messagesByConversation);
  const activeConversationId = useChatUiStore((state) => state.activeConversationId);
  const draftModel = useChatUiStore((state) => state.draftModel);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const followOutputRef = useRef(true);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const conversation = conversations.find((item) => item.id === activeConversationId) ?? null;
  const messages = activeConversationId
    ? messagesByConversation[activeConversationId] ?? EMPTY_MESSAGES
    : EMPTY_MESSAGES;
  const lastMessage = messages.at(-1);

  const scrollToBottom = useEffectEvent(() => {
    const container = scrollAreaRef.current;
    if (!container) {
      return;
    }

    container.scrollTop = container.scrollHeight;
  });

  useEffect(() => {
    followOutputRef.current = true;
    const frame = window.requestAnimationFrame(() => {
      scrollToBottom();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeConversationId]);

  useEffect(() => {
    if (!conversation || !followOutputRef.current) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      scrollToBottom();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [conversation, lastMessage?.content, lastMessage?.id, lastMessage?.status]);

  if (!initialized) {
    return (
      <div className={styles.bootScreen}>
        <Flex
          vertical
          align="center"
          gap={16}
        >
          <Spin size="large" />
          <div className={styles.bootText}>正在准备你的 AI 工作台...</div>
        </Flex>
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      <Layout className={styles.layout}>
        <Sider
          width={312}
          className={styles.sider}
        >
          <ConversationSidebar />
        </Sider>
        <Content className={styles.content}>
          <div className={styles.workspace}>
            <ChatHeader
              conversation={conversation}
              modelId={conversation?.model ?? draftModel}
            />

            <Flex
              vertical
              className={styles.workspaceBody}
            >
              <div
                ref={scrollAreaRef}
                className={styles.scrollArea}
                onScroll={(event) => {
                  const container = event.currentTarget;
                  const distanceToBottom =
                    container.scrollHeight - container.clientHeight - container.scrollTop;
                  followOutputRef.current = distanceToBottom < 96;
                }}
              >
                {conversation && messages.length > 0 ? (
                  <ChatMessageList
                    conversation={conversation}
                    messages={messages}
                  />
                ) : (
                  <ChatWelcome
                    onPromptSelect={(prompt) => {
                      void sendMessage(prompt);
                    }}
                  />
                )}
              </div>

              <ChatComposer conversation={conversation} />
            </Flex>
          </div>
        </Content>
      </Layout>
    </div>
  );
}
