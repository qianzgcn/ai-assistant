import { BulbOutlined } from '@ant-design/icons';
import Prompts from '@ant-design/x/es/prompts';
import Welcome from '@ant-design/x/es/welcome';

import { WELCOME_PROMPTS } from '@/features/chat/model/chat.constants';

import styles from '@/features/chat/components/ChatWelcome.module.css';

export function ChatWelcome({ onPromptSelect }: { onPromptSelect: (prompt: string) => void }) {
  return (
    <div className={styles.welcomeWrap}>
      <div className={styles.welcomeInner}>
        <Welcome
          variant="borderless"
          className={styles.welcome}
          icon={<BulbOutlined />}
          title="把想法交给 Ling Workspace"
          description="支持多会话、本地持久化和流式 mock，适合作为后续接真实后端前的前端工作台。"
        />

        <Prompts
          title="试试这些问题"
          wrap
          items={WELCOME_PROMPTS.map((item) => ({
            key: item,
            label: item,
            description: '点击后会直接发送到当前草稿会话。',
          }))}
          className={styles.promptPanel}
          onItemClick={({ data }) => onPromptSelect(data.key)}
        />
      </div>
    </div>
  );
}
