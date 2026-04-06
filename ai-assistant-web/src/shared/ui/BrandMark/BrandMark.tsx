import styles from '@/shared/ui/BrandMark/BrandMark.module.css';

export function BrandMark() {
  return (
    <div className={styles.brand}>
      <div className={styles.logo}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" strokeWidth="1.5"/>
          <circle cx="8" cy="10" r="1.5" fill="currentColor"/>
          <circle cx="12" cy="10" r="1.5" fill="currentColor"/>
          <circle cx="16" cy="10" r="1.5" fill="currentColor"/>
          <path d="M8 15h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
      <div>
        <div className={styles.name}>AI 助手</div>
        <div className={styles.caption}>智能对话工作台</div>
      </div>
    </div>
  );
}
