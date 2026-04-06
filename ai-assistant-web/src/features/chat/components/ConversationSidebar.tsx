import { startTransition, useDeferredValue, useMemo, useState } from 'react';

import {
  DeleteOutlined,
  EditOutlined,
  MessageOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import Conversations from '@ant-design/x/es/conversations';
import Button from 'antd/es/button';
import Flex from 'antd/es/flex';
import Input from 'antd/es/input';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';

import { formatConversationTime } from '@/features/chat/lib/format-conversation-time';
import { groupConversationsByRecency } from '@/features/chat/lib/group-conversations-by-recency';
import type { ChatMessage, Conversation } from '@/features/chat/model/chat.types';
import { useChatStore } from '@/features/chat/store/chat.store';
import { useChatUiStore } from '@/features/chat/store/chat-ui.store';
import { BrandMark } from '@/shared/ui/BrandMark/BrandMark';

import styles from '@/features/chat/components/ConversationSidebar.module.css';

const EMPTY_MESSAGES: ChatMessage[] = [];

function ConversationItemLabel({
  conversation,
  active,
  editing,
  onRename,
}: {
  conversation: Conversation;
  active: boolean;
  editing: boolean;
  onRename: (conversationId: string, title: string) => Promise<void>;
}) {
  const [draftTitle, setDraftTitle] = useState(conversation.title);
  const messages = useChatStore(
    (state) => state.messagesByConversation[conversation.id] ?? EMPTY_MESSAGES,
  );
  const lastMessage = messages.at(-1);
  const setEditingConversationId = useChatUiStore((state) => state.setEditingConversationId);

  return (
    <div className={styles.itemLabel}>
      <div className={styles.itemTopRow}>
        {editing ? (
          <Input
            autoFocus
            size="small"
            value={draftTitle}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => setDraftTitle(event.target.value)}
            onBlur={() => {
              void onRename(conversation.id, draftTitle);
              setEditingConversationId(null);
            }}
            onPressEnter={() => {
              void onRename(conversation.id, draftTitle);
              setEditingConversationId(null);
            }}
          />
        ) : (
          <Typography.Text
            strong={active}
            ellipsis
            className={styles.itemTitle}
          >
            {conversation.title}
          </Typography.Text>
        )}
        <span className={styles.itemTime}>{formatConversationTime(conversation.updatedAt)}</span>
      </div>
      <div className={styles.itemBottomRow}>
        <Typography.Text
          ellipsis
          type="secondary"
          className={styles.itemPreview}
        >
          {lastMessage?.content || '等待开始新的对话'}
        </Typography.Text>
        {conversation.status === 'generating' ? (
          <Tag
            variant="filled"
            color="processing"
            className={styles.statusTag}
          >
            生成中
          </Tag>
        ) : null}
      </div>
    </div>
  );
}

export function ConversationSidebar() {
  const conversations = useChatStore((state) => state.conversations);
  const renameConversation = useChatStore((state) => state.renameConversation);
  const deleteConversation = useChatStore((state) => state.deleteConversation);
  const activeConversationId = useChatUiStore((state) => state.activeConversationId);
  const searchQuery = useChatUiStore((state) => state.searchQuery);
  const deferredQuery = useDeferredValue(searchQuery);
  const setSearchQuery = useChatUiStore((state) => state.setSearchQuery);
  const setActiveConversationId = useChatUiStore((state) => state.setActiveConversationId);
  const editingConversationId = useChatUiStore((state) => state.editingConversationId);
  const setEditingConversationId = useChatUiStore((state) => state.setEditingConversationId);

  const filteredConversations = useMemo(() => {
    const keyword = deferredQuery.trim().toLowerCase();
    if (!keyword) {
      return conversations;
    }

    return conversations.filter((conversation) => {
      return conversation.title.toLowerCase().includes(keyword);
    });
  }, [conversations, deferredQuery]);

  const conversationGroups = useMemo(() => {
    return groupConversationsByRecency(filteredConversations);
  }, [filteredConversations]);

  const items = useMemo(() => {
    return conversationGroups.flatMap((group) =>
      group.items.map((conversation) => ({
        key: conversation.id,
        label: (
          <ConversationItemLabel
            conversation={conversation}
            active={conversation.id === activeConversationId}
            editing={conversation.id === editingConversationId}
            onRename={renameConversation}
          />
        ),
        group: group.label,
        icon: <MessageOutlined className={styles.itemIcon} />,
      })),
    );
  }, [
    activeConversationId,
    conversationGroups,
    editingConversationId,
    renameConversation,
  ]);

  return (
    <div className={styles.sidebar}>
      <div className={styles.header}>
        <BrandMark />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          className={styles.newButton}
          onClick={() => {
            setEditingConversationId(null);
            startTransition(() => {
              setActiveConversationId(null);
            });
          }}
        >
          新建会话
        </Button>
      </div>

      <Input
        allowClear
        size="large"
        prefix={<SearchOutlined />}
        value={searchQuery}
        placeholder="搜索会话"
        onChange={(event) => {
          startTransition(() => {
            setSearchQuery(event.target.value);
          });
        }}
      />

      <Flex
        justify="space-between"
        align="center"
        className={styles.metaRow}
      >
        <Typography.Text className={styles.metaText}>
          共 {filteredConversations.length} 个会话
        </Typography.Text>
        {deferredQuery ? (
          <Tag
            variant="filled"
            color="blue"
          >
            已筛选
          </Tag>
        ) : null}
      </Flex>

      <div className={styles.listWrap}>
        <Conversations
          items={items}
          activeKey={activeConversationId ?? undefined}
          groupable={{
            label: (group) => <span className={styles.groupLabel}>{group}</span>,
          }}
          onActiveChange={(value) => {
            setEditingConversationId(null);
            startTransition(() => {
              setActiveConversationId(String(value));
            });
          }}
          menu={(info) => ({
            items: [
              {
                key: 'rename',
                label: '重命名',
                icon: <EditOutlined />,
              },
              {
                key: 'delete',
                label: '删除',
                icon: <DeleteOutlined />,
                danger: true,
              },
            ],
            onClick: ({ key, domEvent }) => {
              domEvent.stopPropagation();
              if (key === 'rename') {
                setEditingConversationId(info.key);
              }

              if (key === 'delete') {
                void deleteConversation(info.key);
              }
            },
          })}
          classNames={{
            root: styles.listRoot,
            group: styles.groupBlock,
            item: styles.listItem,
          }}
        />
      </div>
    </div>
  );
}
