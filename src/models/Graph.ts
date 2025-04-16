import { z } from 'zod';
import { randomUUID } from 'node:crypto';

// 图的状态枚举
export const GraphStatus = {
  DRAFT: 'draft',       // 草稿状态，正在编辑
  PUBLISHED: 'published', // 已发布，可以被查看
  ARCHIVED: 'archived', // 已归档，只读
} as const;

// 图谱类型枚举
export const GraphType = {
  TOPOLOGY: 'topology',     // 拓扑结构图
  TIMELINE: 'timeline',     // 时间线图谱
  CHANGELOG: 'changelog',   // 变更日志图谱
  REQUIREMENT: 'requirement', // 需求文档图谱
  KNOWLEDGE_BASE: 'knowledge_base', // 知识库图谱
  ONTOLOGY: 'ontology',     // 本体论图谱
} as const;

// 节点类型枚举
export const NodeType = {
  COMPONENT: 'component',    // 组件节点
  MODULE: 'module',          // 模块节点
  SERVICE: 'service',        // 服务节点
  DATA: 'data',              // 数据节点
  API: 'api',                // API节点
  CONCEPT: 'concept',        // 概念节点
  RESOURCE: 'resource',      // 资源节点
  EVENT: 'event',            // 事件节点（用于时间线）
  CHANGE: 'change',          // 变更节点（用于变更日志）
  REQUIREMENT: 'requirement', // 需求节点
  FEATURE: 'feature',        // 功能特性节点
  ITERATION: 'iteration',    // 迭代节点
  DECISION: 'decision',      // 决策节点
  PERSON: 'person',          // 人员节点
} as const;

// 边类型枚举
export const EdgeType = {
  DEPENDS_ON: 'depends_on',       // 依赖关系
  IMPORTS: 'imports',             // 导入关系
  EXTENDS: 'extends',             // 继承关系
  IMPLEMENTS: 'implements',       // 实现关系
  CALLS: 'calls',                 // 调用关系
  REFERENCES: 'references',       // 引用关系
  CONTAINS: 'contains',           // 包含关系
  ASSOCIATED_WITH: 'associated_with', // 关联关系
  PRECEDES: 'precedes',           // 时间先后关系
  TRANSFORMS_TO: 'transforms_to', // 转变关系
  LEADS_TO: 'leads_to',           // 导致关系
  IMPLEMENTS_REQ: 'implements_req', // 实现需求关系
  CREATED_BY: 'created_by',       // 创建者关系
  MODIFIED_BY: 'modified_by',     // 修改者关系
  PART_OF: 'part_of',             // 组成部分关系
} as const;

// 节点接口
export interface Node {
  id: string;
  type: typeof NodeType[keyof typeof NodeType];
  name: string;
  description?: string;
  filePath?: string;        // 文件路径
  metadata?: Record<string, any>; // 额外信息
  createdAt: Date;
  updatedAt: Date;
  resources?: string[];     // 资源引用列表
}

// 边接口
export interface Edge {
  id: string;
  type: typeof EdgeType[keyof typeof EdgeType];
  source: string;           // 源节点ID
  target: string;           // 目标节点ID
  label?: string;           // 关系标签
  weight?: number;          // 权重
  metadata?: Record<string, any>; // 额外信息
  createdAt: Date;
  updatedAt: Date;
}

// 资源接口
export interface Resource {
  id: string;
  name: string;
  type: string;             // 资源类型，如svg, png, md等
  path: string;             // 资源路径
  title?: string;           // 资源标题
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 知识图谱接口
export interface Graph {
  id: string;
  name: string;
  description?: string;
  type: typeof GraphType[keyof typeof GraphType]; // 新增图谱类型字段
  status: typeof GraphStatus[keyof typeof GraphStatus];
  rootNodeId?: string;      // 根节点ID
  nodes: Node[];            // 节点列表
  edges: Edge[];            // 边列表
  resources: Resource[];    // 资源列表
  metadata?: Record<string, any>; // 额外信息
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  archivedAt?: Date;
}

// 简化的节点信息接口
export interface SimpleNode {
  id: string;
  name: string;
  type: typeof NodeType[keyof typeof NodeType];
}

// 简化的图谱信息接口（用于列表展示）
export interface SimpleGraph extends Omit<Graph, 'nodes'> {
  nodes: SimpleNode[];
}

// Zod模式定义
export const NodeSchema = z.object({
  id: z.string().uuid(),
  type: z.enum([
    NodeType.COMPONENT,
    NodeType.MODULE,
    NodeType.SERVICE,
    NodeType.DATA,
    NodeType.API,
    NodeType.CONCEPT,
    NodeType.RESOURCE,
    NodeType.EVENT,
    NodeType.CHANGE,
    NodeType.REQUIREMENT,
    NodeType.FEATURE,
    NodeType.ITERATION,
    NodeType.DECISION,
    NodeType.PERSON
  ]),
  name: z.string(),
  description: z.string().optional(),
  filePath: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  resources: z.array(z.string()).optional()
});

export const EdgeSchema = z.object({
  id: z.string().uuid(),
  type: z.enum([
    EdgeType.DEPENDS_ON,
    EdgeType.IMPORTS,
    EdgeType.EXTENDS,
    EdgeType.IMPLEMENTS,
    EdgeType.CALLS,
    EdgeType.REFERENCES,
    EdgeType.CONTAINS,
    EdgeType.ASSOCIATED_WITH,
    EdgeType.PRECEDES,
    EdgeType.TRANSFORMS_TO,
    EdgeType.LEADS_TO,
    EdgeType.IMPLEMENTS_REQ,
    EdgeType.CREATED_BY,
    EdgeType.MODIFIED_BY,
    EdgeType.PART_OF
  ]),
  source: z.string().uuid(),
  target: z.string().uuid(),
  label: z.string().optional(),
  weight: z.number().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const ResourceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: z.string(),
  path: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const GraphSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  type: z.enum([
    GraphType.TOPOLOGY,
    GraphType.TIMELINE,
    GraphType.CHANGELOG,
    GraphType.REQUIREMENT,
    GraphType.KNOWLEDGE_BASE,
    GraphType.ONTOLOGY
  ]),
  status: z.enum([GraphStatus.DRAFT, GraphStatus.PUBLISHED, GraphStatus.ARCHIVED]),
  rootNodeId: z.string().uuid().optional(),
  nodes: z.array(NodeSchema).default([]),
  edges: z.array(EdgeSchema).default([]),
  resources: z.array(ResourceSchema).default([]),
  metadata: z.record(z.string(), z.any()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  publishedAt: z.date().optional(),
  archivedAt: z.date().optional()
});

// 模型类
export class GraphModel {
  static create(name: string, type: typeof GraphType[keyof typeof GraphType] = GraphType.TOPOLOGY, description?: string): Graph {
    if (!name || typeof name !== 'string') {
      throw new Error(`创建图谱失败: name参数必须是非空字符串，收到的是 ${typeof name}`);
    }

    // 验证类型是否有效
    if (!Object.values(GraphType).includes(type as any)) {
      throw new Error(`创建图谱失败: 无效的图谱类型 "${type}"。有效类型: ${Object.values(GraphType).join(', ')}`);
    }

    if (description !== undefined && typeof description !== 'string') {
      throw new Error(`创建图谱失败: description参数必须是字符串，收到的是 ${typeof description}`);
    }

    const now = new Date();
    return {
      id: randomUUID(),
      name,
      description,
      type,
      status: GraphStatus.DRAFT,
      nodes: [],
      edges: [],
      resources: [],
      createdAt: now,
      updatedAt: now
    };
  }

  static createNode(type: typeof NodeType[keyof typeof NodeType], name: string, description?: string, filePath?: string, metadata?: Record<string, any>): Node {
    const now = new Date();
    return {
      id: randomUUID(),
      type,
      name,
      description,
      filePath,
      metadata,
      createdAt: now,
      updatedAt: now,
      resources: []
    };
  }

  static createEdge(type: typeof EdgeType[keyof typeof EdgeType], source: string, target: string, label?: string, weight?: number, metadata?: Record<string, any>): Edge {
    const now = new Date();
    return {
      id: randomUUID(),
      type,
      source,
      target,
      label,
      weight,
      metadata,
      createdAt: now,
      updatedAt: now
    };
  }

  static createResource(name: string, type: string, path: string, description?: string): Resource {
    const now = new Date();
    return {
      id: randomUUID(),
      name,
      type,
      path,
      description,
      createdAt: now,
      updatedAt: now
    };
  }

  static validate(graph: unknown): Graph {
    const parsed = GraphSchema.parse(graph);
    // 确保所有必需字段都存在，这样TypeScript不会报错
    return {
      id: parsed.id,
      name: parsed.name,
      type: parsed.type || GraphType.TOPOLOGY, // 默认为拓扑结构
      status: parsed.status,
      nodes: parsed.nodes || [],
      edges: parsed.edges || [],
      resources: parsed.resources || [],
      createdAt: parsed.createdAt,
      updatedAt: parsed.updatedAt,
      description: parsed.description,
      rootNodeId: parsed.rootNodeId,
      metadata: parsed.metadata,
      publishedAt: parsed.publishedAt,
      archivedAt: parsed.archivedAt
    };
  }
} 