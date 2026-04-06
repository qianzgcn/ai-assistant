import type { ThemeConfig } from 'antd';

export const appTheme: ThemeConfig = {
  token: {
    colorPrimary: '#6366f1',
    colorSuccess: '#10b981',
    colorWarning: '#f59e0b',
    colorError: '#ef4444',
    colorInfo: '#6366f1',
    colorTextBase: '#1e293b',
    colorBgBase: '#f8fafc',
    colorBorderSecondary: '#e2e8f0',
    borderRadius: 12,
    borderRadiusLG: 16,
    fontSize: 14,
    fontFamily:
      '"Inter", "SF Pro Display", "PingFang SC", "Microsoft YaHei", "Segoe UI", sans-serif',
    boxShadowSecondary: '0 4px 20px rgba(15, 23, 42, 0.06)',
  },
  components: {
    Layout: {
      siderBg: 'rgba(255, 255, 255, 0.8)',
      headerBg: 'transparent',
      bodyBg: 'transparent',
    },
    Button: {
      controlHeight: 40,
    },
    Input: {
      controlHeight: 40,
    },
    Select: {
      controlHeight: 40,
    },
  },
};
