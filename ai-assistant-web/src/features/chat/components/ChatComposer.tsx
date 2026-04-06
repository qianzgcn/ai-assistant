import { useState } from 'react';

import Sender from '@ant-design/x/es/sender';
import Typography from 'antd/es/typography';

import type { Conversation } from '@/features/chat/model/chat.types';
import { useChatStore } from '@/features/chat/store/chat.store';

import styles from '@/features/chat/components/ChatComposer.module.css';

export function ChatComposer({ conversation }: { conversation: Conversation | null }) {
  const sendMessage = useChatStore((state) => state.sendMessage);
  const stopStreaming = useChatStore((state) => state.stopStreaming);
  const [value, setValue] = useState('');

  const loading = conversation?.status === 'generating';

  return (
    <div className={styles.composer}>
      <div className={styles.composerInner}>
        <Sender
          value={value}
          loading={loading}
          submitType="enter"
          autoSize={{ minRows: 1, maxRows: 6 }}
          placeholder={loading ? '正在生成中，可点击停止按钮中断。' : '输入问题，按 Enter 发送，Shift + Enter 换行'}
          onChange={(nextValue) => setValue(nextValue)}
          onSubmit={(message) => {
            const normalized = message.trim();
            if (!normalized) {
              return;
            }

            setValue('');
            void sendMessage(normalized);
          }}
          onCancel={() => {
            if (conversation) {
              stopStreaming(conversation.id);
            }
          }}
          footer={
            <Typography.Text className={styles.composerHint}>
              输入 `[mock-error]` 可以主动触发一次错误态，用于联调异常流程。
            </Typography.Text>
          }
        />
      </div>
    </div>
  );
}
