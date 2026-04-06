import { useState } from 'react';

import { EditOutlined } from '@ant-design/icons';
import Button from 'antd/es/button';
import Flex from 'antd/es/flex';
import Input from 'antd/es/input';
import Select from 'antd/es/select';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';

import { MODEL_OPTIONS } from '@/features/chat/model/chat.constants';
import type { Conversation } from '@/features/chat/model/chat.types';
import { useChatStore } from '@/features/chat/store/chat.store';

import styles from '@/features/chat/components/ChatHeader.module.css';

function getStatusLabel(status: Conversation['status']) {
  if (status === 'generating') {
    return { color: 'processing', text: '生成中' };
  }

  if (status === 'error') {
    return { color: 'error', text: '异常' };
  }

  return { color: 'default', text: '就绪' };
}

export function ChatHeader({
  conversation,
  modelId,
}: {
  conversation: Conversation | null;
  modelId: string;
}) {
  const renameConversation = useChatStore((state) => state.renameConversation);
  const updateConversationModel = useChatStore((state) => state.updateConversationModel);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(conversation?.title ?? '');

  const statusTag = conversation ? getStatusLabel(conversation.status) : null;

  return (
    <div className={styles.header}>
      <div className={styles.headerInner}>
        <Flex
          justify="space-between"
          align="center"
          gap={16}
        >
          <div className={styles.headerMain}>
            <Typography.Text className={styles.headerEyebrow}>当前工作区</Typography.Text>
            {conversation ? (
              editing ? (
                <Input
                  autoFocus
                  value={draftTitle}
                  className={styles.titleInput}
                  onChange={(event) => setDraftTitle(event.target.value)}
                  onBlur={() => {
                    void renameConversation(conversation.id, draftTitle);
                    setEditing(false);
                  }}
                  onPressEnter={() => {
                    void renameConversation(conversation.id, draftTitle);
                    setEditing(false);
                  }}
                />
              ) : (
                <Flex
                  align="center"
                  gap={10}
                >
                  <Typography.Title
                    level={3}
                    className={styles.title}
                  >
                    {conversation.title}
                  </Typography.Title>
                  <Button
                    type="text"
                    icon={<EditOutlined />}
                    onClick={() => {
                      setDraftTitle(conversation.title);
                      setEditing(true);
                    }}
                  />
                </Flex>
              )
            ) : (
              <Typography.Title
                level={3}
                className={styles.title}
              >
                新的对话
              </Typography.Title>
            )}
            <Typography.Paragraph className={styles.headerDescription}>
              {conversation
                ? '消息会保存在本地浏览器缓存中，可随时切换会话继续。'
                : '从推荐问题开始，或者直接输入你的需求。'}
            </Typography.Paragraph>
          </div>

          <Flex
            align="center"
            gap={12}
          >
            {statusTag ? (
              <Tag
                variant="filled"
                color={statusTag.color}
              >
                {statusTag.text}
              </Tag>
            ) : null}
            <Select
              value={modelId}
              className={styles.modelSelect}
              options={MODEL_OPTIONS.map((model) => ({
                label: model.name,
                value: model.id,
              }))}
              onChange={(value) => {
                void updateConversationModel(conversation?.id ?? null, value);
              }}
            />
          </Flex>
        </Flex>
      </div>
    </div>
  );
}
