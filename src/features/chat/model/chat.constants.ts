import type { ModelOption } from '@/features/chat/model/chat.types';

export const CHAT_DB_NAME = 'ling-workspace-db';
export const CHAT_DB_VERSION = 1;
export const CHAT_SCHEMA_VERSION = 1;
export const DEFAULT_CONVERSATION_TITLE = '新会话';
export const DEFAULT_MODEL_ID = 'mock-gpt-4.1';

export const MODEL_OPTIONS: ModelOption[] = [
  {
    id: 'mock-gpt-4.1',
    name: 'Mock GPT-4.1',
    description: '偏均衡的通用模型，适合大多数日常任务。',
    enabled: true,
  },
  {
    id: 'mock-gpt-4.1-mini',
    name: 'Mock GPT-4.1 Mini',
    description: '响应更快，适合高频问答与轻量任务。',
    enabled: true,
  },
  {
    id: 'mock-o4-reasoner',
    name: 'Mock O4 Reasoner',
    description: '更强调结构化推理与分步解释。',
    enabled: true,
  },
];

export const WELCOME_PROMPTS = [
  '帮我制定一个 React 项目的目录规范',
  '把这段需求拆成开发任务清单',
  '解释一下 useDeferredValue 的适用场景',
  '写一个带代码示例的接口设计文档模板',
];
