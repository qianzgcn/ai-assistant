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
          icon={
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor" opacity="0.2"/>
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
            </svg>
          }
          title="把想法交给 AI 助手"
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
