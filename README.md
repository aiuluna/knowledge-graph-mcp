# Knowledge Graph MCP

A Model Context Protocol (MCP) service for managing and visualizing knowledge graphs. This service provides a comprehensive solution for creating, managing, and analyzing knowledge graphs with support for various graph types including topology, timeline, changelog, and more.

## Features

- Multiple graph types support:
  - Topology (Component topology structure)
  - Timeline (Time-based event tracking)
  - Changelog (Change history tracking)
  - Requirement (Requirement documentation)
  - Knowledge Base
  - Ontology

- Rich node and edge management
- Resource attachment support (SVG and Markdown)
- Comprehensive graph visualization
- MCP standard compliance

## Installation

```bash
npm install @aiuluna/knowledge-graph-mcp
```

## Usage

```typescript
import { KnowledgeGraphMCP } from '@aiuluna/knowledge-graph-mcp';

// Create a new graph
const graph = await KnowledgeGraphMCP.createGraph({
  name: 'My Knowledge Graph',
  type: 'topology',
  description: 'A sample topology graph'
});

// Add nodes
const nodeA = await graph.addNode({
  type: 'component',
  name: 'Component A'
});

const nodeB = await graph.addNode({
  type: 'component',
  name: 'Component B'
});

// Add edges
await graph.addEdge({
  type: 'depends_on',
  sourceId: nodeA.id,
  targetId: nodeB.id
});
```

## API Documentation

### Graph Management

- `createGraph(options)`: Create a new knowledge graph
- `listGraphs(filters)`: List all graphs
- `publishGraph(graphId)`: Publish a graph

### Node Operations

- `addNode(options)`: Add a new node to the graph
- `updateNode(nodeId, options)`: Update an existing node
- `deleteNode(nodeId)`: Delete a node

### Edge Operations

- `addEdge(options)`: Add a new edge between nodes
- `updateEdge(edgeId, options)`: Update an existing edge
- `deleteEdge(edgeId)`: Delete an edge

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.