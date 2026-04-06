import type { PropsWithChildren } from 'react';

import AntdApp from 'antd/es/app';
import ConfigProvider from 'antd/es/config-provider';
import XProvider from '@ant-design/x/es/x-provider';

import { appTheme } from '@/app/theme/antd-theme';

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ConfigProvider theme={appTheme}>
      <AntdApp>
        <XProvider>{children}</XProvider>
      </AntdApp>
    </ConfigProvider>
  );
}
