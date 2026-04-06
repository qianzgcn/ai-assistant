# Ling Workspace 技术设计

## 1. 技术栈
- React 19.2.4
- Ant Design 6.3.5
- `@ant-design/x` 2.5.0
- Vite 8.0.4
- Zustand 5
- IndexedDB + `idb`

## 2. 分层设计
- `src/app`：应用入口、Provider、主题、全局样式
- `src/entities/chat`：领域类型、映射、仓储、纯函数
- `src/features/chat`：聊天页面状态与 UI 组件
- `src/features/conversations`：会话管理 UI
- `src/services/mock-ai`：mock 聊天服务与流式模拟
- `src/shared`：品牌组件与浏览器存储工具

## 3. 状态设计
- `useChatStore`
  - 持有会话集合与消息集合
  - 负责初始化、发送消息、重命名、删除、切换模型、重新生成、停止生成
- `useUiStore`
  - 持有当前激活会话、搜索关键字、草稿模型、当前编辑中的会话
  - 与 `localStorage` 同步轻量 UI 偏好

## 4. 持久化设计
- IndexedDB
  - `conversations`：保存会话元数据
  - `messages`：保存消息内容
  - `meta`：预留扩展
- `localStorage`
  - 当前激活会话 ID
  - 草稿模型 ID

## 5. 流式设计
- mock 服务以异步生成器输出事件
- 事件类型：
  - `message_start`
  - `title_generated`
  - `message_delta`
  - `message_end`
  - `error`
- 流式阶段仅更新内存态，完成或异常时再落库最终消息

## 6. 组件职责
- `ConversationSidebar`：左侧会话列表、搜索、新建、菜单操作
- `ChatHeader`：标题、模型切换、状态展示
- `ChatWelcome`：欢迎页与推荐问题
- `ChatMessageList`：消息列表与消息级操作
- `ChatComposer`：输入、发送、停止生成
- `MarkdownMessage`：Markdown 与代码块渲染

## 7. 后续扩展点
- 将 `mockChatService` 替换成真实 SSE 服务
- 增加附件与多模态消息类型
- 增加消息级工具调用与结构化结果卡片
- 增加 schema 迁移逻辑
