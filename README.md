# Knowledge Graph MCP Server

一个基于 Model Context Protocol (MCP) 的知识图谱服务，为 AI 助手提供知识图谱的创建、管理、分析和可视化能力。本服务完全遵循 MCP 标准，可以与支持 MCP 的 AI 助手（如 Claude）无缝集成。

## 核心特性

* **多种图谱类型**: 支持拓扑结构、时间线、变更日志、需求文档、知识库、本体论等多种图谱类型
* **完整的错误处理**: 为常见问题提供清晰的错误信息和处理建议
* **资源管理**: 支持 SVG 和 Markdown 资源的关联和管理
* **版本状态**: 支持草稿、已发布、已归档等多种状态管理

## 安装与配置

### 环境要求
- Node.js >= 16.0.0
- pnpm >= 7.0.0

### 配置知识图谱目录
创建一个目录用于存储知识图谱数据，例如：
```bash
mkdir ~/knowledge_graph
```

### 在 Cursor 中使用
将以下配置添加到 Cursor 的配置文件中：

```json
{
  "mcpServers": {
    "knowledge-graph": {
      "command": "npx",
      "args": [
        "-y",
        "@aiuluna/knowledge-graph-mcp"
      ],
      "env": {
        "KNOWLEDGE_GRAPH_DIR": "/path/to/your/knowledge_graph/dir"
      }
    }
  }
}
```

注意：
- 将 `KNOWLEDGE_GRAPH_DIR` 替换为您实际的知识图谱存储目录路径
- 可以根据需要指定特定的版本号，如 `@0.0.1`

### 在 Claude Desktop 中使用
将以下配置添加到 `claude_desktop_config.json` 中：

```json
{
  "mcpServers": {
    "knowledge-graph": {
      "command": "npx",
      "args": [
        "-y",
        "@aiuluna/knowledge-graph-mcp"
      ],
      "env": {
        "KNOWLEDGE_GRAPH_DIR": "/path/to/your/knowledge_graph/dir"
      }
    }
  }
}
```

## Prompt 使用指南

### 项目结构
项目中的 prompt 文件位于 `/src/rules/prompts` 目录下, 请将该文件拷贝到您 cursor 中并添加为 Agent 模式下的默认 rule（具体请参考 [Cursor Rules配置](https://docs.cursor.com/context/rules)）：
```
.cursor/
  └── rules/
      └── graph-query.mdc    # 知识图谱查询的 prompt 文件
```

### Agent 模式使用
在 Cursor 中使用 Agent 模式时，可以通过以下方式触发知识图谱查询：

1. 在编辑器中输入 `/ck` 命令
2. Agent 将自动调用 `@graph-query.mdc` 中定义的 prompt
3. prompt 会执行以下操作：
   - 分析当前上下文
   - 查询相关的知识图谱节点
   - 生成总结性内容
   - 将查询结果整合到对话中

### 其他的 rules
项目中另有生成手绘风格的 prompt 和生成 markdown 的 prompt 用来生成作为知识图谱的 resources 存储。因 cursor 不支持 prompt 的 mcp 标准，因此本项目使用 tool 的方式获取该规则，您也可以将其与上面的 rules 一样，集成到 cursor 的 rules中去自己修改成期望的风格，并在 cursor Agent 模式下使用。

## 工具列表

### 图谱管理

1. `create_graph`
   * 创建新的知识图谱
   * 输入参数：
     * `name` (string): 图谱名称
     * `description` (string, 可选): 图谱描述
     * `type` (string): 图谱类型（topology/timeline/changelog/requirement/kb/ontology）

2. `list_graphs`
   * 列出所有知识图谱
   * 输入参数：
     * `status` (string, 可选): 按状态筛选（draft/published/archived）
     * `type` (string, 可选): 按类型筛选

3. `publish_graph`
   * 发布知识图谱
   * 输入参数：
     * `graphId` (string): 图谱ID

### 节点管理

1. `add_node`
   * 向图谱添加节点
   * 输入参数：
     * `graphId` (string): 图谱ID
     * `type` (string): 节点类型
     * `name` (string): 节点名称
     * `description` (string, 可选): 节点描述
     * `filePath` (string, 可选): 关联文件路径
     * `metadata` (object, 可选): 节点元数据

2. `update_node`
   * 更新节点信息
   * 输入参数：
     * `graphId` (string): 图谱ID
     * `nodeId` (string): 节点ID
     * `name` (string, 可选): 新的节点名称
     * `description` (string, 可选): 新的节点描述
     * `filePath` (string, 可选): 新的文件路径
     * `metadata` (object, 可选): 新的元数据

3. `delete_node`
   * 删除节点
   * 输入参数：
     * `graphId` (string): 图谱ID
     * `nodeId` (string): 节点ID
     * `confirmDelete` (boolean): 删除确认

4. `get_node_details`
   * 获取节点详细信息
   * 输入参数：
     * `graphId` (string): 图谱ID
     * `nodeId` (string): 节点ID

### 边管理

1. `add_edge`
   * 添加边
   * 输入参数：
     * `graphId` (string): 图谱ID
     * `type` (string): 边类型
     * `sourceId` (string): 源节点ID
     * `targetId` (string): 目标节点ID
     * `label` (string, 可选): 边标签
     * `weight` (number, 可选): 边权重
     * `metadata` (object, 可选): 边元数据

2. `update_edge`
   * 更新边信息
   * 输入参数：
     * `graphId` (string): 图谱ID
     * `edgeId` (string): 边ID
     * `label` (string, 可选): 新的边标签
     * `weight` (number, 可选): 新的边权重
     * `metadata` (object, 可选): 新的元数据

3. `delete_edge`
   * 删除边
   * 输入参数：
     * `graphId` (string): 图谱ID
     * `edgeId` (string): 边ID
     * `confirmDelete` (boolean): 删除确认

### 资源管理

1. `get_creation_guidelines`
   * 获取资源创建规范
   * 输入参数：
     * `type` (string): 规范类型（svg/markdown/all）

2. `save_resource`
   * 保存资源
   * 输入参数：
     * `graphId` (string): 图谱ID
     * `nodeId` (string, 可选): 关联的节点ID
     * `resourceType` (string): 资源类型（svg/markdown）
     * `title` (string): 资源标题
     * `description` (string, 可选): 资源描述
     * `content` (string): 资源内容

3. `update_resource`
   * 更新资源信息
   * 输入参数：
     * `graphId` (string): 图谱ID
     * `resourceId` (string): 资源ID
     * `name` (string, 可选): 新的资源名称
     * `title` (string, 可选): 新的资源标题
     * `description` (string, 可选): 新的资源描述

4. `delete_resource`
   * 删除资源
   * 输入参数：
     * `graphId` (string): 图谱ID
     * `resourceId` (string): 资源ID
     * `confirmDelete` (boolean): 删除确认

5. `unlink_resource`
   * 解除资源与节点的关联
   * 输入参数：
     * `graphId` (string): 图谱ID
     * `nodeId` (string): 节点ID
     * `resourceId` (string): 资源ID

## 开发

```bash
# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 构建项目
pnpm build

# 运行测试
pnpm test

# 代码检查
pnpm lint
```

## 错误处理

服务使用标准的错误处理机制，所有错误都会被记录到 `md/error_log.txt` 文件中，包含时间戳、错误信息和堆栈跟踪。

## 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件。

