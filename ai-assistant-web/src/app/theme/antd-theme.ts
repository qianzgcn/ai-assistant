import type { ThemeConfig } from 'antd';

export const appTheme: ThemeConfig = {
  token: {
    colorPrimary: '#3b82f6',
    colorSuccess: '#22c55e',
    colorWarning: '#f59e0b',
    colorError: '#ef4444',
    colorInfo: '#3b82f6',
    colorTextBase: '#f1f5f9',
    colorBgBase: '#0f172a',
    colorBgContainer: '#1e293b',
    colorBgElevated: '#334155',
    colorBorder: '#334155',
    colorBorderSecondary: '#475569',
    borderRadius: 8,
    borderRadiusLG: 12,
    fontSize: 14,
    fontFamily:
      '"SF Pro Display", "PingFang SC", "Microsoft YaHei", "Segoe UI", sans-serif',
    boxShadowSecondary: '0 4px 20px rgba(0, 0, 0, 0.3)',
    colorText: '#f1f5f9',
    colorTextSecondary: '#94a3b8',
    colorTextTertiary: '#64748b',
  },
  components: {
    Layout: {
      siderBg: '#1e293b',
      headerBg: '#0f172a',
      bodyBg: '#0f172a',
    },
    Button: {
      controlHeight: 40,
      colorPrimary: '#3b82f6',
      colorPrimaryHover: '#2563eb',
    },
    Input: {
      controlHeight: 40,
      colorBgContainer: '#1e293b',
      colorBorder: '#334155',
    },
    Select: {
      controlHeight: 40,
      colorBgContainer: '#1e293b',
      colorBorder: '#334155',
    },
  },
};
