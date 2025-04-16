# Knowledge Graph MCP Server

A Model Context Protocol (MCP) service for creating, managing, analyzing, and visualizing knowledge graphs. This service fully complies with the MCP standard and seamlessly integrates with MCP-compatible AI assistants (such as Claude).

[![smithery badge](https://smithery.ai/badge/@aiuluna/knowledge-graph-mcp)](https://smithery.ai/server/@aiuluna/knowledge-graph-mcp)
[中文文档](./README.zh-CN.md)

## Core Features

* **Multiple Graph Types**: Support for topology structures, timelines, changelogs, requirement documents, knowledge bases, ontologies, and more
* **Complete Error Handling**: Clear error messages and handling suggestions for common issues
* **Resource Management**: Support for SVG and Markdown resource association and management
* **Version Status**: Support for multiple status management including draft, published, and archived

## Installation & Configuration

### Installing via Smithery

To install knowledge-graph-mcp for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@aiuluna/knowledge-graph-mcp):

```bash
npx -y @smithery/cli install @aiuluna/knowledge-graph-mcp --client claude
```

### Requirements
- Node.js >= 16.0.0
- pnpm >= 7.0.0

### Configure Knowledge Graph Directory
Create a directory to store knowledge graph data, for example:
```bash
mkdir ~/knowledge_graph
```

### Usage in Cursor
Add the following configuration to your Cursor config file:

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

Note:
- Replace `KNOWLEDGE_GRAPH_DIR` with your actual knowledge graph storage directory path
- You can specify a particular version number, such as `@0.0.1`

### Usage in Claude Desktop
Add the following configuration to `claude_desktop_config.json`:

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

## Prompt Usage Guide

### Project Structure
Prompt files are located in the `/src/rules/prompts` directory. Please copy these files to your Cursor and add them as default rules for Agent mode (refer to [Cursor Rules Configuration](https://docs.cursor.com/context/rules)):
```
.cursor/
  └── rules/
      └── graph-query.mdc    # Knowledge graph query prompt file
```

### Using Agent Mode
When using Agent mode in Cursor, you can trigger knowledge graph queries by:

1. Type `/ck` command in the editor
2. The Agent will automatically invoke the prompt defined in `@graph-query.mdc`
3. The prompt will:
   - Analyze current context
   - Query relevant knowledge graph nodes
   - Generate summary content
   - Integrate query results into the conversation

### Other Rules
The project also includes prompts for generating hand-drawn style graphics and Markdown documents as knowledge graph resources. Since Cursor doesn't support the MCP standard for prompts, this project uses tools to obtain these rules. You can also integrate them into Cursor's rules like above and modify them to your desired style for use in Cursor Agent mode.

## Tool List

### Graph Management

1. `create_graph`
   * Create a new knowledge graph
   * Parameters:
     * `name` (string): Graph name
     * `description` (string, optional): Graph description
     * `type` (string): Graph type (topology/timeline/changelog/requirement/kb/ontology)

2. `list_graphs`
   * List all knowledge graphs
   * Parameters:
     * `status` (string, optional): Filter by status (draft/published/archived)
     * `type` (string, optional): Filter by type

3. `publish_graph`
   * Publish a knowledge graph
   * Parameters:
     * `graphId` (string): Graph ID

### Node Management

1. `add_node`
   * Add a node to the graph
   * Parameters:
     * `graphId` (string): Graph ID
     * `type` (string): Node type
     * `name` (string): Node name
     * `description` (string, optional): Node description
     * `filePath` (string, optional): Associated file path
     * `metadata` (object, optional): Node metadata

2. `update_node`
   * Update node information
   * Parameters:
     * `graphId` (string): Graph ID
     * `nodeId` (string): Node ID
     * `name` (string, optional): New node name
     * `description` (string, optional): New node description
     * `filePath` (string, optional): New file path
     * `metadata` (object, optional): New metadata

3. `delete_node`
   * Delete a node
   * Parameters:
     * `graphId` (string): Graph ID
     * `nodeId` (string): Node ID
     * `confirmDelete` (boolean): Delete confirmation

4. `get_node_details`
   * Get detailed node information
   * Parameters:
     * `graphId` (string): Graph ID
     * `nodeId` (string): Node ID

### Edge Management

1. `add_edge`
   * Add an edge
   * Parameters:
     * `graphId` (string): Graph ID
     * `type` (string): Edge type
     * `sourceId` (string): Source node ID
     * `targetId` (string): Target node ID
     * `label` (string, optional): Edge label
     * `weight` (number, optional): Edge weight
     * `metadata` (object, optional): Edge metadata

2. `update_edge`
   * Update edge information
   * Parameters:
     * `graphId` (string): Graph ID
     * `edgeId` (string): Edge ID
     * `label` (string, optional): New edge label
     * `weight` (number, optional): New edge weight
     * `metadata` (object, optional): New metadata

3. `delete_edge`
   * Delete an edge
   * Parameters:
     * `graphId` (string): Graph ID
     * `edgeId` (string): Edge ID
     * `confirmDelete` (boolean): Delete confirmation

### Resource Management

1. `get_creation_guidelines`
   * Get resource creation guidelines
   * Parameters:
     * `type` (string): Guideline type (svg/markdown/all)

2. `save_resource`
   * Save a resource
   * Parameters:
     * `graphId` (string): Graph ID
     * `nodeId` (string, optional): Associated node ID
     * `resourceType` (string): Resource type (svg/markdown)
     * `title` (string): Resource title
     * `description` (string, optional): Resource description
     * `content` (string): Resource content

3. `update_resource`
   * Update resource information
   * Parameters:
     * `graphId` (string): Graph ID
     * `resourceId` (string): Resource ID
     * `name` (string, optional): New resource name
     * `title` (string, optional): New resource title
     * `description` (string, optional): New resource description

4. `delete_resource`
   * Delete a resource
   * Parameters:
     * `graphId` (string): Graph ID
     * `resourceId` (string): Resource ID
     * `confirmDelete` (boolean): Delete confirmation

5. `unlink_resource`
   * Unlink a resource from a node
   * Parameters:
     * `graphId` (string): Graph ID
     * `nodeId` (string): Node ID
     * `resourceId` (string): Resource ID

## Development

```bash
# Install dependencies
pnpm install

# Development mode
pnpm dev

# Build project
pnpm build

# Run tests
pnpm test

# Code check
pnpm lint
```

## Error Handling

The service uses a standard error handling mechanism. All errors are logged to the `md/error_log.txt` file, including timestamps, error messages, and stack traces.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
