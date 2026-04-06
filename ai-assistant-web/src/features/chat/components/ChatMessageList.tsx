import { useMemo } from 'react';

import { CopyOutlined, ReloadOutlined } from '@ant-design/icons';
import Bubble from '@ant-design/x/es/bubble';
import type { BubbleItemType } from '@ant-design/x/es/bubble';
import App from 'antd/es/app';
import Button from 'antd/es/button';
import Flex from 'antd/es/flex';
import Typography from 'antd/es/typography';

import { MarkdownMessage } from '@/features/chat/components/MarkdownMessage';
import type { ChatMessage, Conversation } from '@/features/chat/model/chat.types';
import { useChatStore } from '@/features/chat/store/chat.store';

import styles from '@/features/chat/components/ChatMessageList.module.css';

function mapBubbleStatus(status: ChatMessage['status']): BubbleItemType['status'] {
  if (status === 'streaming') {
    return 'updating';
  }

  if (status === 'completed') {
    return 'success';
  }

  if (status === 'error') {
    return 'error';
  }

  if (status === 'stopped') {
    return 'abort';
  }

  return 'local';
}

export function ChatMessageList({
  conversation,
  messages,
}: {
  conversation: Conversation;
  messages: ChatMessage[];
}) {
  const regenerateLastAnswer = useChatStore((state) => state.regenerateLastAnswer);
  const { message } = App.useApp();

  const lastAssistantMessageId = useMemo(
    () => messages.filter((item) => item.role === 'assistant').at(-1)?.id,
    [messages],
  );
  const messagesById = useMemo(
    () => new Map(messages.map((item) => [item.id, item])),
    [messages],
  );

  const items = useMemo(() => {
    return messages.map((item): BubbleItemType => ({
      key: item.id,
      role: item.role === 'assistant' ? 'assistant' : item.role,
      content: item.content || (item.status === 'streaming' ? ' ' : '暂无内容'),
      status: mapBubbleStatus(item.status),
      extraInfo: {
        messageId: item.id,
        messageStatus: item.status,
      },
    }));
  }, [messages]);

  return (
    <div className={styles.messageList}>
      <Bubble.List
        items={items}
        role={{
          assistant: {
            placement: 'start',
            variant: 'borderless',
            avatar: <div className={styles.assistantAvatar}>Ling</div>,
            contentRender: (content) => <MarkdownMessage content={String(content)} />,
            footer: (_content, info) => {
              const target = messagesById.get(String(info.key));
              if (!target) {
                return null;
              }

              const showRegenerate =
                target.id === lastAssistantMessageId &&
                (target.status === 'completed' || target.status === 'error' || target.status === 'stopped');

              return (
                <Flex gap={8}>
                  <Button
                    size="small"
                    type="text"
                    icon={<CopyOutlined />}
                    onClick={() => {
                      void navigator.clipboard.writeText(target.content);
                      void message.success('已复制回复内容');
                    }}
                  >
                    复制
                  </Button>
                  {showRegenerate ? (
                    <Button
                      size="small"
                      type="text"
                      icon={<ReloadOutlined />}
                      onClick={() => {
                        void regenerateLastAnswer(conversation.id);
                      }}
                    >
                      重新生成
                    </Button>
                  ) : null}
                </Flex>
              );
            },
          },
          user: {
            placement: 'end',
            variant: 'shadow',
            shape: 'corner',
            className: styles.userBubble,
            contentRender: (content) => <div className={styles.userMessage}>{String(content)}</div>,
          },
        }}
      />
      {messages.length === 0 ? (
        <Typography.Text className={styles.messagePlaceholder}>开始你的第一条消息吧。</Typography.Text>
      ) : null}
    </div>
  );
}
