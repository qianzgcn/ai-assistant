import type { ThemeConfig } from 'antd';

export const appTheme: ThemeConfig = {
  token: {
    colorPrimary: '#6B73B0',
    colorSuccess: '#34C759',
    colorWarning: '#FF9500',
    colorError: '#FF3B30',
    colorInfo: '#6B73B0',
    colorTextBase: '#2D2D3A',
    colorBgBase: '#F8F8FA',
    colorBorderSecondary: '#E8E8ED',
    borderRadius: 6,
    borderRadiusLG: 8,
    fontSize: 14,
    fontFamily:
      '"Inter", "SF Pro Display", "PingFang SC", "Microsoft YaHei", "Segoe UI", sans-serif',
    boxShadowSecondary: '0 1px 3px rgba(0, 0, 0, 0.02)',
  },
  components: {
    Layout: {
      siderBg: '#FFFFFF',
      headerBg: 'transparent',
      bodyBg: 'transparent',
    },
    Button: {
      controlHeight: 34,
    },
    Input: {
      controlHeight: 34,
    },
    Select: {
      controlHeight: 34,
    },
  },
};
