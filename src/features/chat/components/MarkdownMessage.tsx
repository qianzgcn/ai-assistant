import { useMemo } from 'react';

import { CopyOutlined } from '@ant-design/icons';
import Button from 'antd/es/button';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';

import styles from '@/features/chat/components/MarkdownMessage.module.css';

export function MarkdownMessage({ content }: { content: string }) {
  const markdown = useMemo(() => content.trim(), [content]);

  return (
    <div className={styles.markdown}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className ?? '');
            const code = Array.isArray(children)
              ? children
                  .map((child) => (typeof child === 'string' ? child : ''))
                  .join('')
                  .replace(/\n$/, '')
              : typeof children === 'string'
                ? children.replace(/\n$/, '')
                : '';

            if (!match) {
              return (
                <code
                  className={styles.inlineCode}
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return (
              <div className={styles.codeBlock}>
                <div className={styles.codeHeader}>
                  <span>{match[1]}</span>
                  <Button
                    size="small"
                    type="text"
                    icon={<CopyOutlined />}
                    onClick={() => {
                      void navigator.clipboard.writeText(code);
                    }}
                  >
                    复制
                  </Button>
                </div>
                <pre className={styles.codeContent}>
                  <code>{code}</code>
                </pre>
              </div>
            );
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
