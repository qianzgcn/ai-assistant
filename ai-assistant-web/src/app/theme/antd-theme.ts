import type { ThemeConfig } from 'antd';

export const appTheme: ThemeConfig = {
  token: {
    colorPrimary: '#2667ff',
    colorSuccess: '#16a34a',
    colorWarning: '#f59e0b',
    colorError: '#dc2626',
    colorInfo: '#2667ff',
    colorTextBase: '#111827',
    colorBgBase: '#f5f7fb',
    colorBorderSecondary: '#dbe3f0',
    borderRadius: 16,
    borderRadiusLG: 20,
    fontSize: 14,
    fontFamily:
      '"SF Pro Display", "PingFang SC", "Microsoft YaHei", "Segoe UI", sans-serif',
    boxShadowSecondary: '0 14px 40px rgba(15, 23, 42, 0.08)',
  },
  components: {
    Layout: {
      siderBg: 'rgba(250, 252, 255, 0.82)',
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
