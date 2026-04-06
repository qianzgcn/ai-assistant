# Ling Workspace 项目指导

本文档基于当前项目实现和本次开发对话沉淀，作为后续继续开发、重构、接入真实后端时的默认约定。

## 项目目标
- 这是一个桌面优先的中文 AI 对话 Web 应用。
- 当前阶段以前端工作台为主，接口全部使用 mock。
- 产品核心是多会话、本地持久化、流式回复、欢迎态、模型选择占位。
- 未来默认朝 OpenAI 兼容 SSE 接口接入真实后端。

## 技术基线
- React 19
- Ant Design 6
- `@ant-design/x` 2
- Vite 8
- TypeScript
- Zustand
- IndexedDB + `idb`

## 运行要求
- 必须使用 Node `20.19.5` 或更高版本。
- Windows 下推荐使用 `nvm-windows`。
- 新开终端后先执行：

```powershell
nvm use 20.19.5
node -v
```

- 常用命令：

```powershell
npm run dev
npm run lint
npm test
npm run build
```

## 文档入口
- 产品需求：[docs/prd.md](C:/Users/admin/Documents/Playground/docs/prd.md)
- 技术设计：[docs/tech-design.md](C:/Users/admin/Documents/Playground/docs/tech-design.md)
- mock 接口：[docs/mock-api.md](C:/Users/admin/Documents/Playground/docs/mock-api.md)

## 目录职责
- `src/app`：应用装配、Provider、主题、全局样式
- `src/entities/chat`：领域类型、仓储、映射、纯函数
- `src/features/chat`：聊天主工作区、消息区、输入区、状态 store
- `src/features/conversations`：左侧会话管理
- `src/services/mock-ai`：mock 聊天服务、流式输出模拟
- `src/shared`：通用工具、品牌组件、浏览器存储辅助
- `public`：静态资源

## 当前实现约束
- 界面与代码注释统一使用中文。
- 单页工作台模式，首版不做多路由。
- 仅支持文本对话，不做附件、多模态、登录和云同步。
- 会话与消息持久化到 IndexedDB。
- 当前激活会话和草稿模型持久化到 `localStorage`。
- “重新生成”只针对最近一次助手回复，不支持历史消息分叉编辑。

## 状态管理约定
- `useChatStore` 负责业务状态。
- `useUiStore` 负责轻量 UI 状态。
- 不要在 `zustand` selector 里直接返回新的对象或数组默认值。
- 特别注意不要写这类代码：

```ts
useChatStore((state) => state.messagesByConversation[id] ?? [])
```

- 这会在 React 19 下触发不稳定快照，可能导致无限更新。
- 正确做法是使用模块级稳定常量，例如：

```ts
const EMPTY_MESSAGES: ChatMessage[] = [];
useChatStore((state) => state.messagesByConversation[id] ?? EMPTY_MESSAGES)
```

## UI 与交互约定
- 左侧为会话管理，右侧为对话工作区。
- 风格是浅色、克制、生产力导向，不要往花哨营销页方向偏。
- 优先延续现有布局和主题 token，不要随意引入第二套视觉语言。
- 聊天相关 UI 优先基于 `@ant-design/x` 的 `Conversations`、`Bubble.List`、`Sender`、`Welcome`、`Prompts`。
- Markdown 渲染保持安全默认，不信任原始 HTML。

## mock 服务约定
- 所有聊天流默认经 `mockChatService`。
- mock 流式事件统一走归一化事件层，不让 UI 直接耦合真实后端包格式。
- 输入 `[mock-error]` 会主动触发一次错误态，用于联调异常流程。
- 接入真实后端时，优先保持 `ChatService` 接口稳定，只替换服务实现。

## 工程约定
- 改动前优先保持职责边界清晰，不把仓储、服务、UI 逻辑混在组件里。
- 复杂逻辑优先落到 `entities`、`services` 或 `model` 层。
- 新增功能后至少运行：

```powershell
npm run lint
npm test
npm run build
```

- 如果改动涉及本地调试页面，额外检查浏览器 console 是否为 0 errors、0 warnings。

## 已知优化方向
- 当前构建已做基础拆包，但 `antd` 和 Markdown 相关依赖仍然偏大。
- 后续可以继续做动态导入和更细粒度的 vendor 拆分。
- 如果接入真实后端，优先补错误恢复、会话同步策略和更完整的测试覆盖。
