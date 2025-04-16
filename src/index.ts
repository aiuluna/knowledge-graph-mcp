#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { KnowledgeGraphService } from './services/KnowledgeGraphService';
import { KnowledgeGraphConfigSchema } from './config/types';
import { NodeType, EdgeType, GraphStatus, GraphType } from './models/Graph';
import * as fs from 'fs/promises';
import * as fsSync from 'node:fs';
import path from 'path';
import { loadConfigFromEnv } from './config/environment';
import { formatLocalDateTime } from './utils/datetime';

// 导入规范文件
import svgGuidelinesContent from './rules/handdrawn_svg_guidelines.md?raw';
import mdGuidelinesContent from './rules/markdown_document_guidelines.md?raw';

// 工具定义
const CREATE_GRAPH_TOOL: Tool = {
  name: "create_graph",
  description: "创建新的知识图谱。支持多种图谱类型，如拓扑结构、时间线、变更日志、需求文档等。各图谱类型设计指南：\n" +
    "- topology(组件拓扑结构图)：用于表示系统组件、模块间的依赖关系，建议先创建主要模块节点，再添加组件节点，最后通过边表示调用、依赖、包含等关系\n" +
    "- timeline(时间线图谱)：用于记录项目重要事件和决策，建议按时间顺序添加事件节点，并链接相关人员和决策\n" +
    "- changelog(变更日志图谱)：用于追踪功能和组件的变更历史，建议为每个重要变更创建节点，标记变更类型和影响范围\n" +
    "- requirement(需求文档图谱)：用于需求管理和追踪，建议先创建高层需求，再分解为具体功能点，最后关联到负责人和迭代\n" +
    "- knowledge_base(知识库图谱)：用于构建领域知识体系，建议从核心概念开始，逐步扩展相关概念和关系\n" +
    "- ontology(本体论图谱)：用于定义领域概念和关系的形式化表示，适合构建标准化的知识模型",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string" },
      description: { type: "string" },
      type: {
        type: "string",
        enum: Object.values(GraphType),
        description: "图谱类型。topology:组件拓扑结构图,timeline:时间线图谱,changelog:变更日志图谱,requirement:需求文档图谱,knowledge_base:知识库图谱,ontology:本体论图谱"
      }
    },
    required: ["name"]
  }
};

const ADD_NODE_TOOL: Tool = {
  name: "add_node",
  description: "向知识图谱添加节点。节点是图谱的基本单元，不同类型的图谱支持不同类型的节点。",
  inputSchema: {
    type: "object",
    properties: {
      graphId: { type: "string" },
      type: {
        type: "string",
        enum: Object.values(NodeType),
        description: "节点类型。组件拓扑图:component/module/service/data/api/concept/resource, 时间线图谱:event/decision/iteration/person, 变更日志:change/feature/component/iteration/person, 需求文档:requirement/feature/component/iteration/person/decision"
      },
      name: { type: "string" },
      description: { type: "string" },
      filePath: { type: "string" },
      metadata: { type: "object" }
    },
    required: ["graphId", "type", "name"]
  }
};

const ADD_EDGE_TOOL: Tool = {
  name: "add_edge",
  description: "在知识图谱中添加边，连接两个节点以构建关系网络。边表示节点之间的关系类型，如依赖、包含、关联等。\n" +
    "使用前提：\n" +
    "1. 必须先创建图谱（使用create_graph）\n" +
    "2. 必须已经创建了源节点和目标节点\n" +
    "3. 边的类型必须与图谱类型匹配\n\n" +
    "使用建议：\n" +
    "1. 先使用list_graphs获取图谱和节点信息\n" +
    "2. 确认源节点和目标节点都存在且类型匹配\n" +
    "3. 根据图谱类型选择合适的边类型\n" +
    "4. 为边添加有意义的标签，帮助理解关系\n" +
    "5. 如果关系有强弱之分，可以通过weight参数表示\n\n" +
    "返回数据：\n" +
    "- data: 新创建的边信息\n" +
    "  * id: 边ID\n" +
    "  * type: 边类型\n" +
    "  * sourceId: 源节点ID\n" +
    "  * targetId: 目标节点ID\n" +
    "  * label: 边标签\n" +
    "  * weight: 边权重",
  inputSchema: {
    type: "object",
    properties: {
      graphId: { type: "string" },
      type: {
        type: "string",
        enum: Object.values(EdgeType),
        description: "边类型。组件拓扑图:depends_on/imports/extends/implements/calls/references/contains/associated_with, 时间线图谱:precedes/leads_to/created_by/modified_by, 变更日志:precedes/transforms_to/created_by/modified_by/part_of, 需求文档:implements_req/depends_on/part_of/created_by/modified_by"
      },
      sourceId: { type: "string" },
      targetId: { type: "string" },
      label: { type: "string" },
      weight: { type: "number" }
    },
    required: ["graphId", "type", "sourceId", "targetId"]
  }
};

const PUBLISH_GRAPH_TOOL: Tool = {
  name: "publish_graph",
  description: "发布知识图谱，将图谱状态从草稿变更为已发布。发布后的图谱仍然可以修改，但建议通过版本管理跟踪重要变更。\n" +
    "使用前提：\n" +
    "1. 图谱必须存在且处于草稿状态\n" +
    "2. 建议在发布前确保图谱内容完整\n" +
    "3. 确保所有必要的节点和边都已添加\n\n" +
    "使用建议：\n" +
    "1. 先使用list_graphs检查图谱的当前状态\n" +
    "2. 使用get_node_details检查关键节点的完整性\n" +
    "3. 在发布前对图谱结构进行最后审查\n" +
    "4. 记录发布时间，用于版本管理\n" +
    "5. 发布后及时通知相关团队成员\n\n" +
    "返回数据：\n" +
    "- data: 发布后的图谱信息\n" +
    "  * id: 图谱ID\n" +
    "  * name: 图谱名称\n" +
    "  * type: 图谱类型\n" +
    "  * status: 已发布\n" +
    "  * publishedAt: 发布时间",
  inputSchema: {
    type: "object",
    properties: {
      graphId: { type: "string" }
    },
    required: ["graphId"]
  }
};

const LIST_GRAPHS_TOOL: Tool = {
  name: "list_graphs",
  description: "列出所有知识图谱，支持按状态和类型筛选。这是获取已有图谱信息的主要工具，也是获取节点ID的重要途径。\n" +
    "使用场景：\n" +
    "1. 查看所有可用的图谱及其基本信息\n" +
    "2. 获取特定图谱的节点列表，用于后续的边添加或节点详情查询\n" +
    "3. 按状态筛选图谱，如查看所有草稿或已发布的图谱\n" +
    "4. 按类型筛选图谱，如只查看拓扑图或时间线图谱\n\n" +
    "使用建议：\n" +
    "1. 首先调用此工具获取图谱列表和节点信息\n" +
    "2. 从返回的数据中获取需要的图谱ID和节点ID\n" +
    "3. 使用这些ID调用其他工具（如add_edge、get_node_details）\n" +
    "4. 建议在进行任何节点或边操作前，先用此工具确认目标图谱的状态\n\n" +
    "返回数据：\n" +
    "- data: 图谱列表，每个图谱包含：\n" +
    "  * id: 图谱ID（用于其他工具的graphId参数）\n" +
    "  * name: 图谱名称\n" +
    "  * description: 图谱描述\n" +
    "  * type: 图谱类型\n" +
    "  * status: 图谱状态\n" +
    "  * nodesCount: 节点数量\n" +
    "  * edgesCount: 边数量\n" +
    "  * createdAt: 创建时间\n" +
    "  * updatedAt: 更新时间\n" +
    "  * publishedAt: 发布时间（如果已发布）\n" +
    "  * nodes: 节点列表，每个节点包含：\n" +
    "    - id: 节点ID（用于add_edge和get_node_details等工具）\n" +
    "    - name: 节点名称\n" +
    "    - type: 节点类型",
  inputSchema: {
    type: "object",
    properties: {
      status: {
        type: "string",
        enum: Object.values(GraphStatus),
        description: "图谱状态筛选：\n" +
          "- draft: 草稿状态，可以自由修改\n" +
          "- published: 已发布状态，建议通过版本管理跟踪变更\n" +
          "- archived: 已归档状态，不建议修改"
      },
      type: {
        type: "string",
        enum: Object.values(GraphType),
        description: "图谱类型筛选：\n" +
          "- topology: 组件拓扑结构图\n" +
          "- timeline: 时间线图谱\n" +
          "- changelog: 变更日志图谱\n" +
          "- requirement: 需求文档图谱\n" +
          "- knowledge_base: 知识库图谱\n" +
          "- ontology: 本体论图谱"
      }
    }
  }
};

const GET_NODE_DETAILS_TOOL: Tool = {
  name: "get_node_details",
  description: "获取图谱中特定节点的详细信息。此工具需要配合list_graphs工具使用，因为nodeId必须从list_graphs的返回结果中获取。\n" +
    "使用场景：\n" +
    "1. 查看节点的完整属性信息\n" +
    "2. 检查节点关联的资源（SVG/Markdown）\n" +
    "3. 分析节点与其他节点的关系网络\n" +
    "4. 在修改节点前查看当前状态\n\n" +
    "使用建议：\n" +
    "1. 先调用list_graphs获取目标图谱的节点列表\n" +
    "2. 从返回的nodes数组中获取需要的nodeId\n" +
    "3. 使用获取到的graphId和nodeId调用本工具\n" +
    "4. 检查返回的关系数据，确定是否需要进一步操作\n\n" +
    "返回数据：\n" +
    "- data: 节点详细信息\n" +
    "  * id: 节点ID\n" +
    "  * name: 节点名称\n" +
    "  * type: 节点类型\n" +
    "  * description: 节点描述\n" +
    "  * filePath: 关联文件路径\n" +
    "  * metadata: 节点元数据\n" +
    "  * resources: 关联资源列表\n" +
    "    - id: 资源ID\n" +
    "    - type: 资源类型(svg/markdown)\n" +
    "    - title: 资源标题\n" +
    "  * relationships: 关系列表\n" +
    "    - id: 边ID\n" +
    "    - type: 边类型\n" +
    "    - targetNode: 目标节点信息",
  inputSchema: {
    type: "object",
    properties: {
      graphId: {
        type: "string",
        description: "图谱ID，必须从list_graphs的返回数据中获取"
      },
      nodeId: {
        type: "string",
        description: "节点ID，必须从list_graphs返回的nodes数组中获取"
      }
    },
    required: ["graphId", "nodeId"]
  }
};

const GET_CREATION_GUIDELINES_TOOL: Tool = {
  name: "get_creation_guidelines",
  description: "获取SVG图形和Markdown文档的创建规范和指南。此工具是save_resource工具的前置工具，必须在创建和保存任何资源前调用。\n" +
    "使用场景：\n" +
    "1. 创建SVG可视化图形前获取绘制规范\n" +
    "2. 创建Markdown文档前获取格式要求\n" +
    "3. 批量创建资源前获取完整规范\n\n" +
    "使用建议：\n" +
    "1. 在开始任何资源创建前，先调用此工具获取规范\n" +
    "2. 仔细阅读并遵循规范中的命名规则和目录结构\n" +
    "3. 根据规范创建资源后，使用save_resource工具保存\n" +
    "4. 建议将规范保存下来，供团队成员参考\n\n" +
    "返回数据：\n" +
    "- data: 规范内容\n" +
    "  * guidelines: 规范文本内容\n" +
    "    - 文件命名规则\n" +
    "    - 目录结构要求\n" +
    "    - 格式规范\n" +
    "    - 样式指南\n" +
    "  * type: 规范类型（svg/markdown/all）\n" +
    "  * version: 规范版本",
  inputSchema: {
    type: "object",
    properties: {
      type: {
        type: "string",
        enum: ["svg", "markdown", "all"],
        description: "规范类型：\n" +
          "- svg: SVG图形创建规范，包含绘制风格、命名规则等\n" +
          "- markdown: Markdown文档规范，包含格式要求、目录结构等\n" +
          "- all: 获取所有规范（推荐）"
      }
    },
    required: ["type"]
  }
};

const SAVE_RESOURCE_TOOL: Tool = {
  name: "save_resource",
  description: "保存AI创建的SVG图形或Markdown文档到知识图谱。此工具需要配合get_creation_guidelines和list_graphs工具使用。\n" +
    "使用场景：\n" +
    "1. 保存图谱的SVG可视化表示\n" +
    "2. 保存节点相关的Markdown文档\n" +
    "3. 批量保存多个资源文件\n\n" +
    "使用建议：\n" +
    "1. 先调用get_creation_guidelines获取资源创建规范\n" +
    "2. 使用list_graphs获取目标图谱ID和节点ID（如需关联到节点）\n" +
    "3. 按规范创建资源内容\n" +
    "4. 使用本工具保存资源\n" +
    "5. 保存后可使用get_node_details查看资源关联状态\n\n" +
    "返回数据：\n" +
    "- data: 保存的资源信息\n" +
    "  * id: 资源ID\n" +
    "  * type: 资源类型（svg/markdown）\n" +
    "  * title: 资源标题\n" +
    "  * description: 资源描述\n" +
    "  * nodeId: 关联的节点ID（如果有）\n" +
    "  * createdAt: 创建时间",
  inputSchema: {
    type: "object",
    properties: {
      graphId: {
        type: "string",
        description: "图谱ID，必须从list_graphs的返回数据中获取"
      },
      nodeId: {
        type: "string",
        description: "关联的节点ID（可选），如果提供则必须从list_graphs的nodes数组中获取"
      },
      resourceType: {
        type: "string",
        enum: ["svg", "markdown"],
        description: "资源类型：\n" +
          "- svg: SVG图形文件\n" +
          "- markdown: Markdown文档"
      },
      title: {
        type: "string",
        description: "资源标题，必须符合get_creation_guidelines中的命名规范"
      },
      description: {
        type: "string",
        description: "资源描述（可选）"
      },
      content: {
        type: "string",
        description: "资源内容，必须符合get_creation_guidelines中的格式规范"
      }
    },
    required: ["graphId", "resourceType", "title", "content"]
  }
};

const DELETE_GRAPH_TOOL: Tool = {
  name: "delete_graph",
  description: "删除知识图谱。此工具需要配合list_graphs工具使用，且操作不可撤销。\n" +
    "使用场景：\n" +
    "1. 删除不再需要的图谱\n" +
    "2. 清理测试或临时创建的图谱\n" +
    "3. 重新规划和组织知识结构\n\n" +
    "使用建议：\n" +
    "1. 先调用list_graphs获取要删除的图谱ID和基本信息\n" +
    "2. 使用get_node_details检查图谱中的重要节点和资源\n" +
    "3. 确认删除不会影响其他图谱或系统\n" +
    "4. 设置confirmId与graphId完全一致以确认删除\n" +
    "5. 建议在删除前备份重要数据\n\n" +
    "返回数据：\n" +
    "- data: 删除结果\n" +
    "  * id: 被删除的图谱ID\n" +
    "  * name: 图谱名称\n" +
    "  * deletedAt: 删除时间",
  inputSchema: {
    type: "object",
    properties: {
      graphId: {
        type: "string",
        description: "要删除的图谱ID，必须从list_graphs的返回数据中获取"
      },
      confirmId: {
        type: "string",
        description: "确认删除的图谱ID，必须与graphId完全一致，这是一个安全措施，防止误删除"
      }
    },
    required: ["graphId", "confirmId"]
  }
};

const UPDATE_NODE_TOOL: Tool = {
  name: "update_node",
  description: "修改知识图谱中的节点。此工具需要配合list_graphs和get_node_details工具使用。\n" +
    "使用场景：\n" +
    "1. 更新节点的基本信息（名称、描述等）\n" +
    "2. 更新节点关联的文件路径\n" +
    "3. 更新节点的元数据信息\n\n" +
    "使用建议：\n" +
    "1. 先调用list_graphs获取目标图谱和节点ID\n" +
    "2. 使用get_node_details查看节点当前状态\n" +
    "3. 只更新需要修改的字段，其他字段保持不变\n" +
    "4. 更新后可再次调用get_node_details确认修改\n\n" +
    "返回数据：\n" +
    "- data: 更新后的节点信息\n" +
    "  * id: 节点ID\n" +
    "  * name: 节点名称\n" +
    "  * type: 节点类型\n" +
    "  * description: 节点描述\n" +
    "  * filePath: 关联文件路径\n" +
    "  * metadata: 节点元数据\n" +
    "  * updatedAt: 更新时间",
  inputSchema: {
    type: "object",
    properties: {
      graphId: {
        type: "string",
        description: "图谱ID，必须从list_graphs的返回数据中获取"
      },
      nodeId: {
        type: "string",
        description: "节点ID，必须从list_graphs的nodes数组中获取"
      },
      name: {
        type: "string",
        description: "新的节点名称（可选）"
      },
      description: {
        type: "string",
        description: "新的节点描述（可选）"
      },
      filePath: {
        type: "string",
        description: "新的关联文件路径（可选）"
      },
      metadata: {
        type: "object",
        description: "新的节点元数据（可选）"
      }
    },
    required: ["graphId", "nodeId"]
  }
};

const UPDATE_EDGE_TOOL: Tool = {
  name: "update_edge",
  description: "修改知识图谱中的边。此工具需要配合list_graphs和get_node_details工具使用。\n" +
    "使用场景：\n" +
    "1. 更新边的标签信息\n" +
    "2. 调整边的权重值\n" +
    "3. 更新边的元数据信息\n\n" +
    "使用建议：\n" +
    "1. 先调用list_graphs获取目标图谱信息\n" +
    "2. 使用get_node_details查看相关节点的边列表\n" +
    "3. 只更新需要修改的字段，其他字段保持不变\n" +
    "4. 更新后可再次调用get_node_details确认修改\n\n" +
    "返回数据：\n" +
    "- data: 更新后的边信息\n" +
    "  * id: 边ID\n" +
    "  * type: 边类型\n" +
    "  * sourceId: 源节点ID\n" +
    "  * targetId: 目标节点ID\n" +
    "  * label: 边标签\n" +
    "  * weight: 边权重\n" +
    "  * metadata: 边元数据\n" +
    "  * updatedAt: 更新时间",
  inputSchema: {
    type: "object",
    properties: {
      graphId: {
        type: "string",
        description: "图谱ID，必须从list_graphs的返回数据中获取"
      },
      edgeId: {
        type: "string",
        description: "边ID，必须从get_node_details的relationships数组中获取"
      },
      label: {
        type: "string",
        description: "新的边标签（可选）"
      },
      weight: {
        type: "number",
        description: "新的边权重（可选），用于表示关系的强弱程度"
      },
      metadata: {
        type: "object",
        description: "新的边元数据（可选）"
      }
    },
    required: ["graphId", "edgeId"]
  }
};

const DELETE_NODE_TOOL: Tool = {
  name: "delete_node",
  description: "删除知识图谱中的节点。此工具需要配合list_graphs工具使用，且操作不可撤销。\n" +
    "使用场景：\n" +
    "1. 删除错误创建的节点\n" +
    "2. 删除不再需要的节点\n" +
    "3. 重构图谱结构时删除冗余节点\n\n" +
    "使用建议：\n" +
    "1. 先调用list_graphs获取目标图谱和节点信息\n" +
    "2. 使用get_node_details检查节点的关联资源和关系\n" +
    "3. 确认删除不会影响其他重要节点\n" +
    "4. 设置confirmDelete为true以确认删除\n" +
    "5. 建议在删除前备份重要数据\n\n" +
    "注意事项：\n" +
    "- 删除节点会同时删除与该节点相关的所有边\n" +
    "- 如果节点有关联的资源，资源不会被删除，但会解除关联\n\n" +
    "返回数据：\n" +
    "- data: 删除结果\n" +
    "  * id: 被删除的节点ID\n" +
    "  * name: 节点名称\n" +
    "  * type: 节点类型\n" +
    "  * deletedAt: 删除时间",
  inputSchema: {
    type: "object",
    properties: {
      graphId: {
        type: "string",
        description: "图谱ID，必须从list_graphs的返回数据中获取"
      },
      nodeId: {
        type: "string",
        description: "节点ID，必须从list_graphs的nodes数组中获取"
      },
      confirmDelete: {
        type: "boolean",
        description: "确认删除，必须设置为true，这是一个安全措施，防止误删除"
      }
    },
    required: ["graphId", "nodeId", "confirmDelete"]
  }
};

const DELETE_EDGE_TOOL: Tool = {
  name: "delete_edge",
  description: "删除知识图谱中的边。此工具需要配合list_graphs和get_node_details工具使用，且操作不可撤销。\n" +
    "使用场景：\n" +
    "1. 删除错误创建的关系\n" +
    "2. 更新节点之间的关系结构\n" +
    "3. 重构图谱时清理冗余关系\n\n" +
    "使用建议：\n" +
    "1. 先调用list_graphs获取目标图谱信息\n" +
    "2. 使用get_node_details获取边的详细信息\n" +
    "3. 确认删除不会破坏重要的关系结构\n" +
    "4. 设置confirmDelete为true以确认删除\n\n" +
    "注意事项：\n" +
    "- 删除边不会影响相关的节点\n" +
    "- 删除后需要重新调用get_node_details查看更新后的关系\n\n" +
    "返回数据：\n" +
    "- data: 删除结果\n" +
    "  * id: 被删除的边ID\n" +
    "  * deletedAt: 删除时间",
  inputSchema: {
    type: "object",
    properties: {
      graphId: {
        type: "string",
        description: "图谱ID，必须从list_graphs的返回数据中获取"
      },
      edgeId: {
        type: "string",
        description: "边ID，必须从get_node_details的relationships数组中获取"
      },
      confirmDelete: {
        type: "boolean",
        description: "确认删除，必须设置为true，这是一个安全措施，防止误删除"
      }
    },
    required: ["graphId", "edgeId", "confirmDelete"]
  }
};

const UPDATE_RESOURCE_TOOL: Tool = {
  name: "update_resource",
  description: "更新知识图谱中的资源信息。此工具需要配合list_graphs和get_node_details工具使用。\n" +
    "使用场景：\n" +
    "1. 修改资源的标题或描述\n" +
    "2. 更新资源的元数据信息\n" +
    "3. 完善资源的文档说明\n\n" +
    "使用建议：\n" +
    "1. 先调用list_graphs获取目标图谱信息\n" +
    "2. 使用get_node_details查看资源当前信息\n" +
    "3. 只更新需要修改的字段\n" +
    "4. 保持资源命名的一致性\n\n" +
    "返回数据：\n" +
    "- data: 更新后的资源信息\n" +
    "  * id: 资源ID\n" +
    "  * name: 资源名称\n" +
    "  * title: 资源标题\n" +
    "  * description: 资源描述\n" +
    "  * updatedAt: 更新时间",
  inputSchema: {
    type: "object",
    properties: {
      graphId: {
        type: "string",
        description: "图谱ID，必须从list_graphs的返回数据中获取"
      },
      resourceId: {
        type: "string",
        description: "资源ID，必须从get_node_details的resources数组中获取"
      },
      name: {
        type: "string",
        description: "新的资源名称（可选）"
      },
      title: {
        type: "string",
        description: "新的资源标题（可选）"
      },
      description: {
        type: "string",
        description: "新的资源描述（可选）"
      }
    },
    required: ["graphId", "resourceId"]
  }
};

const DELETE_RESOURCE_TOOL: Tool = {
  name: "delete_resource",
  description: "删除知识图谱中的资源。此工具需要配合list_graphs和get_node_details工具使用，且操作不可撤销。\n" +
    "使用场景：\n" +
    "1. 删除过时的资源文件\n" +
    "2. 清理不再需要的文档\n" +
    "3. 移除错误创建的资源\n\n" +
    "使用建议：\n" +
    "1. 先调用list_graphs获取目标图谱信息\n" +
    "2. 使用get_node_details确认资源的关联关系\n" +
    "3. 确认删除不会影响其他节点\n" +
    "4. 设置confirmDelete为true以确认删除\n" +
    "5. 建议在删除前备份重要资源\n\n" +
    "注意事项：\n" +
    "- 删除资源会同时删除物理文件\n" +
    "- 会自动解除与所有节点的关联\n" +
    "- 此操作不可恢复\n\n" +
    "返回数据：\n" +
    "- data: 删除结果\n" +
    "  * id: 被删除的资源ID\n" +
    "  * type: 资源类型\n" +
    "  * deletedAt: 删除时间",
  inputSchema: {
    type: "object",
    properties: {
      graphId: {
        type: "string",
        description: "图谱ID，必须从list_graphs的返回数据中获取"
      },
      resourceId: {
        type: "string",
        description: "资源ID，必须从get_node_details的resources数组中获取"
      },
      confirmDelete: {
        type: "boolean",
        description: "确认删除，必须设置为true，这是一个安全措施，防止误删除"
      }
    },
    required: ["graphId", "resourceId", "confirmDelete"]
  }
};

const UNLINK_RESOURCE_TOOL: Tool = {
  name: "unlink_resource",
  description: "解除资源与节点的关联关系。此工具需要配合list_graphs和get_node_details工具使用。\n" +
    "使用场景：\n" +
    "1. 调整资源的关联关系\n" +
    "2. 移除错误的资源关联\n" +
    "3. 重组节点的资源结构\n\n" +
    "使用建议：\n" +
    "1. 先调用list_graphs获取目标图谱信息\n" +
    "2. 使用get_node_details查看节点的资源关联\n" +
    "3. 确认解除关联不会影响其他功能\n" +
    "4. 记录变更以便需要时重新关联\n\n" +
    "注意事项：\n" +
    "- 只解除关联，不删除资源\n" +
    "- 资源仍然可以被其他节点使用\n" +
    "- 可以随时重新建立关联\n\n" +
    "返回数据：\n" +
    "- data: 操作结果\n" +
    "  * resourceId: 资源ID\n" +
    "  * nodeId: 节点ID\n" +
    "  * unlinkedAt: 解除关联时间",
  inputSchema: {
    type: "object",
    properties: {
      graphId: {
        type: "string",
        description: "图谱ID，必须从list_graphs的返回数据中获取"
      },
      nodeId: {
        type: "string",
        description: "节点ID，必须从list_graphs的nodes数组中获取"
      },
      resourceId: {
        type: "string",
        description: "要解除关联的资源ID，必须从get_node_details的resources数组中获取"
      }
    },
    required: ["graphId", "nodeId", "resourceId"]
  }
};

// 创建知识图谱拓扑结构管理服务类
export class KnowledgeGraphServer {
  private graphService: KnowledgeGraphService;

  constructor(config: unknown) {
    this.graphService = new KnowledgeGraphService(KnowledgeGraphConfigSchema.parse(config));
  }

  async init(): Promise<void> {
    await this.graphService.init();
  }

  async handleRequest(toolName: string, parameters: any): Promise<any> {
    console.log(`处理知识图谱工具请求: ${toolName}`, JSON.stringify(parameters, null, 2));

    try {
      switch (toolName) {
        case "create_graph":
          return this.createGraph(parameters);
        case "add_node":
          return this.addNode(parameters);
        case "add_edge":
          return this.addEdge(parameters);
        case "publish_graph":
          return this.publishGraph(parameters);
        case "list_graphs":
          return this.listGraphs(parameters);
        case "get_node_details":
          return this.getNodeDetails(parameters);
        case "get_creation_guidelines":
          return this.getCreationGuidelines(parameters);
        case "save_resource":
          return this.saveResource(parameters);
        case "delete_graph":
          return this.deleteGraph(parameters);
        case "update_node":
          return this.updateNode(parameters);
        case "update_edge":
          return this.updateEdge(parameters);
        case "delete_node":
          return this.deleteNode(parameters);
        case "delete_edge":
          return this.deleteEdge(parameters);
        case "update_resource":
          return this.updateResource(parameters);
        case "delete_resource":
          return this.deleteResource(parameters);
        case "unlink_resource":
          return this.unlinkResource(parameters);
        default:
          throw new Error(`未知知识图谱工具: ${toolName}`);
      }
    } catch (error) {
      console.error('处理请求时发生错误:', error);
      // 将错误信息写入日志文件
      const logFilePath = path.join(process.cwd(), 'md', 'error_log.txt');
      const errorMessage = `时间: ${formatLocalDateTime(new Date())}\n错误: ${error instanceof Error ? error.message : String(error)}\n堆栈: ${error instanceof Error ? error.stack : '无'}\n\n`;
      await fs.appendFile(logFilePath, errorMessage, 'utf-8');
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      };
    }
  }

  private async createGraph(parameters: { name: string; description?: string; type?: string }): Promise<any> {
    try {
      const { name, description, type } = parameters || {};

      if (!name) {
        throw new Error('缺少必需参数: name');
      }

      // 如果类型不在枚举值中，提供明确错误
      if (type && !Object.values(GraphType).includes(type as any)) {
        throw new Error(`无效的图谱类型: ${type}。有效类型: ${Object.values(GraphType).join(', ')}`);
      }

      console.log(`创建图谱，参数: name=${name}, description=${description}, type=${type}`);
      const graph = await this.graphService.createGraph(name, type as any, description);

      return {
        success: true,
        content: [{
          type: "text",
          text: JSON.stringify({
            message: `已创建知识图谱: ${name}`,
            data: {
              id: graph.id,
              name: graph.name,
              description: graph.description,
              type: graph.type,
              status: graph.status
            }
          })
        }]
      };
    } catch (error) {
      console.error('创建图谱失败:', error);
      return this.handleError(error);
    }
  }

  private async addNode(parameters: { graphId: string; type: string; name: string; description?: string; filePath?: string; metadata?: any }): Promise<any> {
    try {
      const { graphId, type, name, description, filePath, metadata } = parameters;
      const node = await this.graphService.addNode(graphId, type as any, name, description, filePath, metadata);

      return {
        success: true,
        content: [{
          type: "text",
          text: JSON.stringify({
            message: `已添加节点: ${name}`,
            data: {
              id: node.id,
              type: node.type,
              name: node.name,
              description: node.description,
              filePath: node.filePath
            }
          })
        }]
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  private async addEdge(parameters: { graphId: string; type: string; sourceId: string; targetId: string; label?: string; weight?: number; metadata?: any }): Promise<any> {
    try {
      const { graphId, type, sourceId, targetId, label, weight, metadata } = parameters;
      const edge = await this.graphService.addEdge(graphId, type as any, sourceId, targetId, label, weight, metadata);

      return {
        success: true,
        content: [{
          type: "text",
          text: JSON.stringify({
            message: `已添加边: ${type}`,
            data: {
              id: edge.id,
              type: edge.type,
              source: edge.source,
              target: edge.target,
              label: edge.label,
              weight: edge.weight
            }
          })
        }]
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  private async publishGraph(parameters: { graphId: string }): Promise<any> {
    try {
      const { graphId } = parameters;
      const graph = await this.graphService.publishGraph(graphId);

      return {
        success: true,
        content: [{
          type: "text",
          text: JSON.stringify({
            message: `已发布知识图谱: ${graph.name}`,
            data: {
              id: graph.id,
              name: graph.name,
              type: graph.type,
              status: graph.status,
              publishedAt: graph.publishedAt
            }
          })
        }]
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  private async listGraphs(parameters: { status?: string; type?: string }): Promise<any> {
    try {
      const { status, type } = parameters;
      let graphs;

      if (type) {
        graphs = await this.graphService.listGraphsByType(type as any, status);
      } else {
        graphs = await this.graphService.listGraphs(status);
      }

      // 构造符合MCP工具协议的返回格式
      return {
        success: true,
        content: [{
          type: "text",
          text: JSON.stringify({
            data: graphs.map(g => ({
              id: g.id,
              name: g.name,
              description: g.description,
              type: g.type,
              status: g.status,
              nodesCount: g.nodes.length,
              edgesCount: g.edges.length,
              createdAt: g.createdAt,
              updatedAt: g.updatedAt,
              publishedAt: g.publishedAt,
              nodes: g.nodes.map(node => ({
                id: node.id,
                name: node.name,
                type: node.type
              }))
            }))
          })
        }]
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  private async getNodeDetails(parameters: { graphId: string; nodeId: string }): Promise<any> {
    try {
      const { graphId, nodeId } = parameters;
      const details = await this.graphService.getNodeDetails(graphId, nodeId);

      return {
        success: true,
        content: [{
          type: "text",
          text: JSON.stringify({
            data: {
              node: details.node,
              incomingEdges: details.incomingEdges,
              outgoingEdges: details.outgoingEdges,
              resources: details.resources
            }
          })
        }]
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  private async getCreationGuidelines(parameters: { type: string }): Promise<any> {
    try {
      const { type } = parameters;
      let guidelines = '';

      if (type === 'svg' || type === 'all') {
        // 使用导入的SVG规范内容
        guidelines += svgGuidelinesContent;
      }

      if (type === 'markdown' || type === 'all') {
        // 使用导入的Markdown规范内容
        if (guidelines) guidelines += '\n\n---\n\n';
        guidelines += mdGuidelinesContent;
      }

      return {
        success: true,
        content: [{
          type: "text",
          text: JSON.stringify({
            message: `已获取${type === 'all' ? '所有' : type === 'svg' ? 'SVG' : 'Markdown'}创作规范`,
            guidelines
          })
        }]
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  private async saveResource(parameters: {
    graphId: string;
    nodeId?: string;
    resourceType: string;
    title: string;
    description?: string;
    content: string;
  }): Promise<any> {
    try {
      const { graphId, nodeId, resourceType, title, description, content } = parameters;

      // 检查图谱是否存在
      await this.graphService.getGraph(graphId);

      // 如果指定了节点ID，检查节点是否存在
      if (nodeId) {
        await this.graphService.getNodeDetails(graphId, nodeId);
      }

      // 根据资源类型保存
      if (resourceType === 'svg') {
        if (nodeId) {
          await this.graphService.saveSvgToNode(graphId, nodeId, title, description || title, content);
        } else {
          await this.graphService.saveGraphSvg(graphId, content);
        }

        return {
          success: true,
          content: [{
            type: "text",
            text: JSON.stringify({
              message: nodeId
                ? `已保存SVG到节点: ${nodeId}`
                : `已保存SVG到图谱: ${graphId}`,
              data: {
                graphId,
                nodeId,
                title,
                resourceType
              }
            })
          }]
        };
      } else if (resourceType === 'markdown') {
        await this.graphService.saveMdToGraph(graphId, nodeId || null, title, content, description || title);

        return {
          success: true,
          content: [{
            type: "text",
            text: JSON.stringify({
              message: nodeId
                ? `已保存Markdown到节点: ${nodeId}`
                : `已保存Markdown到图谱: ${graphId}`,
              data: {
                graphId,
                nodeId,
                title,
                resourceType
              }
            })
          }]
        };
      } else {
        throw new Error(`不支持的资源类型: ${resourceType}`);
      }
    } catch (error) {
      return this.handleError(error);
    }
  }

  private async deleteGraph(parameters: { graphId: string; confirmId: string }): Promise<any> {
    try {
      const { graphId, confirmId } = parameters;

      // 双重确认，防止误删
      if (graphId !== confirmId) {
        throw new Error('确认ID与图谱ID不匹配，删除操作已取消');
      }

      // 先获取图谱信息，确保存在
      const graph = await this.graphService.getGraph(graphId);

      // 实现删除图谱逻辑
      await this.graphService.deleteGraph(graphId);

      return {
        success: true,
        content: [{
          type: "text",
          text: JSON.stringify({
            message: `已删除知识图谱: ${graph.name} (${graphId})`,
            data: {
              id: graphId,
              name: graph.name
            }
          })
        }]
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  private async updateNode(parameters: { graphId: string; nodeId: string; name?: string; description?: string; filePath?: string; metadata?: any }): Promise<any> {
    try {
      const { graphId, nodeId, name, description, filePath, metadata } = parameters;

      // 首先确保要更新的节点存在
      const details = await this.graphService.getNodeDetails(graphId, nodeId);
      const node = details.node;

      // 创建更新对象，只包含提供的参数
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (filePath !== undefined) updateData.filePath = filePath;
      if (metadata !== undefined) updateData.metadata = metadata;

      // 确保至少有一个字段需要更新
      if (Object.keys(updateData).length === 0) {
        throw new Error('至少需要提供一个要更新的字段');
      }

      // 执行更新
      const updatedNode = await this.graphService.updateNode(graphId, nodeId, updateData);

      return {
        success: true,
        content: [{
          type: "text",
          text: JSON.stringify({
            message: `已更新节点: ${updatedNode.name}`,
            data: {
              id: updatedNode.id,
              name: updatedNode.name,
              description: updatedNode.description,
              filePath: updatedNode.filePath,
              type: updatedNode.type,
              updatedAt: updatedNode.updatedAt,
              updatedAtLocal: formatLocalDateTime(updatedNode.updatedAt)
            }
          })
        }]
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  private async updateEdge(parameters: { graphId: string; edgeId: string; label?: string; weight?: number; metadata?: any }): Promise<any> {
    try {
      const { graphId, edgeId, label, weight, metadata } = parameters;

      // 创建更新对象，只包含提供的参数
      const updateData: any = {};
      if (label !== undefined) updateData.label = label;
      if (weight !== undefined) updateData.weight = weight;
      if (metadata !== undefined) updateData.metadata = metadata;

      // 确保至少有一个字段需要更新
      if (Object.keys(updateData).length === 0) {
        throw new Error('至少需要提供一个要更新的字段');
      }

      // 执行更新
      const updatedEdge = await this.graphService.updateEdge(graphId, edgeId, updateData);

      return {
        success: true,
        content: [{
          type: "text",
          text: JSON.stringify({
            message: `已更新边: ${updatedEdge.type}${updatedEdge.label ? ` (${updatedEdge.label})` : ''}`,
            data: {
              id: updatedEdge.id,
              type: updatedEdge.type,
              source: updatedEdge.source,
              target: updatedEdge.target,
              label: updatedEdge.label,
              weight: updatedEdge.weight
            }
          })
        }]
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  private async deleteNode(parameters: { graphId: string; nodeId: string; confirmDelete: boolean }): Promise<any> {
    try {
      const { graphId, nodeId, confirmDelete } = parameters;

      if (!confirmDelete) {
        throw new Error('必须确认删除操作');
      }

      // 获取节点信息，用于返回结果
      const details = await this.graphService.getNodeDetails(graphId, nodeId);
      const node = details.node;

      // 执行删除
      await this.graphService.deleteNode(graphId, nodeId);

      return {
        success: true,
        content: [{
          type: "text",
          text: JSON.stringify({
            message: `已删除节点: ${node.name} (${nodeId})`,
            data: {
              id: nodeId,
              name: node.name,
              type: node.type
            }
          })
        }]
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  private async deleteEdge(parameters: { graphId: string; edgeId: string; confirmDelete: boolean }): Promise<any> {
    try {
      const { graphId, edgeId, confirmDelete } = parameters;

      if (!confirmDelete) {
        throw new Error('必须确认删除操作');
      }

      // 执行删除
      await this.graphService.deleteEdge(graphId, edgeId);

      return {
        success: true,
        content: [{
          type: "text",
          text: JSON.stringify({
            message: `已删除边: ${edgeId}`,
            data: {
              id: edgeId
            }
          })
        }]
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  private async updateResource(parameters: { graphId: string; resourceId: string; name?: string; title?: string; description?: string }): Promise<any> {
    try {
      const { graphId, resourceId, name, title, description } = parameters;

      // 检查图谱是否存在
      await this.graphService.getGraph(graphId);

      // 执行更新
      const updateData = { name, title, description };
      const updatedResource = await this.graphService.updateResource(graphId, resourceId, updateData);

      return {
        success: true,
        content: [{
          type: "text",
          text: JSON.stringify({
            message: `已更新资源: ${updatedResource.name}`,
            data: {
              id: updatedResource.id,
              name: updatedResource.name,
              title: updatedResource.title,
              description: updatedResource.description
            }
          })
        }]
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  private async deleteResource(parameters: { graphId: string; resourceId: string; confirmDelete: boolean }): Promise<any> {
    try {
      const { graphId, resourceId, confirmDelete } = parameters;

      if (!confirmDelete) {
        throw new Error('必须确认删除操作');
      }

      // 执行删除
      await this.graphService.deleteResource(graphId, resourceId);

      return {
        success: true,
        content: [{
          type: "text",
          text: JSON.stringify({
            message: `已删除资源: ${resourceId}`,
            data: {
              id: resourceId
            }
          })
        }]
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  private async unlinkResource(parameters: { graphId: string; nodeId: string; resourceId: string }): Promise<any> {
    try {
      const { graphId, nodeId, resourceId } = parameters;

      // 执行解除关联
      await this.graphService.unlinkResourceFromNode(graphId, nodeId, resourceId);

      return {
        success: true,
        content: [{
          type: "text",
          text: JSON.stringify({
            message: `已解除资源: ${resourceId} 与节点: ${nodeId} 的关联`,
            data: {
              id: resourceId
            }
          })
        }]
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  private handleError(error: unknown) {
    console.error('知识图谱服务错误:', error);

    let errorDetail: any = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    };

    // 如果错误是对象，尝试获取所有属性
    if (error && typeof error === 'object') {
      try {
        // 先复制基本错误信息
        const errorObj = error as any;

        // 添加所有可枚举属性
        for (const key in errorObj) {
          if (key !== 'message' && key !== 'stack') {
            errorDetail[key] = errorObj[key];
          }
        }

        // 检查是否有其他自定义属性
        if (error instanceof Error) {
          // 获取所有属性名
          const propNames = Object.getOwnPropertyNames(error);
          for (const prop of propNames) {
            if (prop !== 'message' && prop !== 'stack' && prop !== 'name') {
              try {
                const value = (error as any)[prop];
                if (typeof value !== 'function') {
                  errorDetail[prop] = value;
                }
              } catch (e) {
                // 忽略不可访问的属性
              }
            }
          }
        }
      } catch (e) {
        errorDetail.extractionError = `无法提取完整错误信息: ${e}`;
      }
    }

    // 符合MCP工具协议的错误响应格式
    return {
      error: errorDetail.message,
      success: false,
      content: [{
        type: "text",
        text: JSON.stringify({
          error: errorDetail.message,
          errorDetail: errorDetail
        })
      }]
    };
  }
}

// 创建服务器实例
const server = new Server(
  {
    name: "knowledge-graph",
    version: "0.0.1",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 从环境变量或命令行获取配置
let config = {};
const configFilePath = process.argv[2];
if (configFilePath) {
  try {
    const configData = fsSync.readFileSync(configFilePath, 'utf-8');
    config = JSON.parse(configData);
    console.log(`已从文件加载配置: ${configFilePath}`);
  } catch (error) {
    console.error(`配置文件读取失败: ${error}`);
  }
} else {
  // 如果没有提供配置文件，尝试从环境变量加载
  try {
    config = loadConfigFromEnv();
    console.log('已从环境变量加载配置');
  } catch (error) {
    console.error(`环境变量配置加载失败: ${error}`);
  }
}

console.log('启动知识图谱服务，配置:', JSON.stringify(config, null, 2));

// 声明服务器变量，但不立即初始化
let knowledgeGraphServer: KnowledgeGraphServer;

// 注册工具列表处理器
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    CREATE_GRAPH_TOOL,
    ADD_NODE_TOOL,
    ADD_EDGE_TOOL,
    PUBLISH_GRAPH_TOOL,
    LIST_GRAPHS_TOOL,
    GET_NODE_DETAILS_TOOL,
    GET_CREATION_GUIDELINES_TOOL,
    SAVE_RESOURCE_TOOL,
    // DELETE_GRAPH_TOOL,  暂不提供该tool，有风险
    UPDATE_NODE_TOOL,
    UPDATE_EDGE_TOOL,
    DELETE_NODE_TOOL,
    DELETE_EDGE_TOOL,
    UPDATE_RESOURCE_TOOL,
    DELETE_RESOURCE_TOOL,
    UNLINK_RESOURCE_TOOL
  ],
}));

// 注册工具调用处理器
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  console.log(`接收到工具调用: ${name}`, JSON.stringify(args, null, 2));

  try {
    // 确保arguments是一个对象
    if (!args || typeof args !== 'object') {
      throw new Error(`工具 ${name} 调用失败: 参数必须是一个有效的对象`);
    }

    // 确保服务器已初始化
    if (!knowledgeGraphServer) {
      throw new Error('知识图谱服务尚未初始化');
    }

    const result = await knowledgeGraphServer.handleRequest(name, args);
    console.log(`工具调用结果: ${name}`, JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error(`工具调用失败: ${name}`, error);
    return {
      error: error instanceof Error ? error.message : String(error),
      success: false
    };
  }
});

async function runServer() {
  try {
    // 在runServer中初始化服务器
    knowledgeGraphServer = new KnowledgeGraphServer(config);
    await knowledgeGraphServer.init();

    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('知识图谱服务已启动');
  } catch (error) {
    console.error('知识图谱服务启动失败:', error);
    process.exit(1);
  }
}
// 处理进程事件
process.on('SIGINT', () => {
  console.log("收到中断信号，正在关闭服务...");
  server.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log("收到终止信号，正在关闭服务...");
  server.close();
  process.exit(0);
});

process.stdin.on("close", () => {
  console.log("输入流关闭，正在关闭服务...");
  server.close();
  process.exit(0);
});

// 添加未捕获异常处理
process.on('uncaughtException', (error) => {
  console.error("未捕获的异常:", error);
  // 不退出进程，尝试继续运行
});

runServer().catch((error) => {
  console.error("服务启动失败:", error);
  process.exit(1);
}); 
