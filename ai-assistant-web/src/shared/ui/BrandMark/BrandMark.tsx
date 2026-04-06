import { RobotOutlined } from '@ant-design/icons';

import styles from '@/shared/ui/BrandMark/BrandMark.module.css';

export function BrandMark() {
  return (
    <div className={styles.brand}>
      <div className={styles.logo}>
        <RobotOutlined />
      </div>
      <div>
        <div className={styles.name}>Ling Workspace</div>
        <div className={styles.caption}>本地优先的 AI 对话工作台</div>
      </div>
    </div>
  );
}
