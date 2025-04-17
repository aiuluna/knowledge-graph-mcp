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
  description: "Create a new knowledge graph. Supports multiple graph types such as topology, timeline, changelog, requirement documentation, etc. Design guidelines for each graph type:\n" +
    "- topology: Used to represent dependencies between system components and modules. Recommended to first create main module nodes, then add component nodes, and finally represent relationships through edges like calls, dependencies, and containment\n" +
    "- timeline: Used to record important project events and decisions. Recommended to add event nodes in chronological order and link related personnel and decisions\n" +
    "- changelog: Used to track change history of features and components. Recommended to create nodes for each significant change, marking change types and impact scope\n" +
    "- requirement: Used for requirement management and tracking. Recommended to first create high-level requirements, then break down into specific features, and finally link to responsible persons and iterations\n" +
    "- knowledge_base: Used to build domain knowledge systems. Recommended to start from core concepts and gradually expand related concepts and relationships\n" +
    "- ontology: Used for formal representation of domain concepts and relationships, suitable for building standardized knowledge models",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string" },
      description: { type: "string" },
      type: {
        type: "string",
        enum: Object.values(GraphType),
        description: "Graph type. topology:Component topology diagram, timeline:Timeline graph, changelog:Change log graph, requirement:Requirement documentation graph, knowledge_base:Knowledge base graph, ontology:Ontology graph"
      }
    },
    required: ["name"]
  }
};

const ADD_NODE_TOOL: Tool = {
  name: "add_node",
  description: "Add a node to the knowledge graph. Nodes are the basic units of the graph, and different types of graphs support different types of nodes.\n" +
    "Use cases:\n" +
    "1. Create component or module nodes in topology graphs\n" +
    "2. Add event or decision nodes in timeline graphs\n" +
    "3. Create requirement or feature nodes in requirement documents\n" +
    "4. Build concept hierarchies in knowledge bases\n\n" +
    "Usage recommendations:\n" +
    "1. First create the graph using create_graph\n" +
    "2. Select the appropriate node type based on graph type\n" +
    "3. Provide meaningful names and descriptions\n" +
    "4. Link related files when applicable\n" +
    "5. Add metadata for additional structured information\n\n" +
    "Return data:\n" +
    "- data: Created node information\n" +
    "  * id: Node ID\n" +
    "  * type: Node type\n" +
    "  * name: Node name\n" +
    "  * description: Node description\n" +
    "  * createdAt: Creation time",
  inputSchema: {
    type: "object",
    properties: {
      graphId: { type: "string" },
      type: {
        type: "string",
        enum: Object.values(NodeType),
        description: "Node type. Topology graph:component/module/service/data/api/concept/resource, Timeline graph:event/decision/iteration/person, Changelog:change/feature/component/iteration/person, Requirement doc:requirement/feature/component/iteration/person/decision"
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
  description: "Add edges in the knowledge graph, connecting two nodes to build a relationship network. Edges represent relationship types between nodes, such as dependencies, containment, associations, etc.\n" +
    "Prerequisites:\n" +
    "1. Must first create a graph (using create_graph)\n" +
    "2. Source and target nodes must already exist\n" +
    "3. Edge type must match the graph type\n\n" +
    "Usage recommendations:\n" +
    "1. First use list_graphs to get graph and node information\n" +
    "2. Confirm both source and target nodes exist and their types match\n" +
    "3. Choose appropriate edge type based on graph type\n" +
    "4. Add meaningful labels to edges to help understand relationships\n" +
    "5. If relationships have varying strengths, use the weight parameter\n\n" +
    "Return data:\n" +
    "- data: Newly created edge information\n" +
    "  * id: Edge ID\n" +
    "  * type: Edge type\n" +
    "  * sourceId: Source node ID\n" +
    "  * targetId: Target node ID\n" +
    "  * label: Edge label\n" +
    "  * weight: Edge weight",
  inputSchema: {
    type: "object",
    properties: {
      graphId: { type: "string" },
      type: {
        type: "string",
        enum: Object.values(EdgeType),
        description: "Edge type. Topology diagram:depends_on/imports/extends/implements/calls/references/contains/associated_with, Timeline graph:precedes/leads_to/created_by/modified_by, Change log:precedes/transforms_to/created_by/modified_by/part_of, Requirements document:implements_req/depends_on/part_of/created_by/modified_by"
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
  description: "Publish a knowledge graph, changing its status from draft to published. Published graphs can still be modified, but it's recommended to track important changes through version management.\n" +
    "Prerequisites:\n" +
    "1. Graph must exist and be in draft status\n" +
    "2. Recommended to ensure graph content is complete before publishing\n" +
    "3. Ensure all necessary nodes and edges have been added\n\n" +
    "Usage recommendations:\n" +
    "1. First use list_graphs to check the current status of the graph\n" +
    "2. Use get_node_details to check the completeness of key nodes\n" +
    "3. Review the graph structure before publishing\n" +
    "4. Record publication time for version management\n" +
    "5. Notify relevant team members after publication\n\n" +
    "Return data:\n" +
    "- data: Published graph information\n" +
    "  * id: Graph ID\n" +
    "  * name: Graph name\n" +
    "  * type: Graph type\n" +
    "  * status: Published\n" +
    "  * publishedAt: Publication time",
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
  description: "List all knowledge graphs with support for filtering by status and type. This is the main tool for getting information about existing graphs and an important path for obtaining node IDs.\n" +
    "Use cases:\n" +
    "1. View all available graphs and their basic information\n" +
    "2. Get the node list of a specific graph for subsequent edge addition or node detail queries\n" +
    "3. Filter graphs by status, such as viewing all drafts or published graphs\n" +
    "4. Filter graphs by type, such as viewing only topology or timeline graphs\n\n" +
    "Usage recommendations:\n" +
    "1. First call this tool to get the graph list and node information\n" +
    "2. Get the required graph ID and node ID from the returned data\n" +
    "3. Use these IDs to call other tools (like add_edge, get_node_details)\n" +
    "4. Recommended to use this tool to confirm the target graph's status before performing any node or edge operations\n\n" +
    "Return data:\n" +
    "- data: List of graphs, each graph contains:\n" +
    "  * id: Graph ID (used for graphId parameter in other tools)\n" +
    "  * name: Graph name\n" +
    "  * description: Graph description\n" +
    "  * type: Graph type\n" +
    "  * status: Graph status\n" +
    "  * nodesCount: Number of nodes\n" +
    "  * edgesCount: Number of edges\n" +
    "  * createdAt: Creation time\n" +
    "  * updatedAt: Update time\n" +
    "  * publishedAt: Publication time (if published)\n" +
    "  * nodes: Node list, each node contains:\n" +
    "    - id: Node ID (used for add_edge and get_node_details tools)\n" +
    "    - name: Node name\n" +
    "    - type: Node type",
  inputSchema: {
    type: "object",
    properties: {
      status: {
        type: "string",
        enum: Object.values(GraphStatus),
        description: "Graph status filter:\n" +
          "- draft: Draft status, can be freely modified\n" +
          "- published: Published status, recommended to track changes through version management\n" +
          "- archived: Archived status, modifications not recommended"
      },
      type: {
        type: "string",
        enum: Object.values(GraphType),
        description: "Graph type filter:\n" +
          "- topology: Component topology diagram\n" +
          "- timeline: Timeline graph\n" +
          "- changelog: Change log graph\n" +
          "- requirement: Requirement documentation graph\n" +
          "- knowledge_base: Knowledge base graph\n" +
          "- ontology: Ontology graph"
      }
    }
  }
};

const GET_NODE_DETAILS_TOOL: Tool = {
  name: "get_node_details",
  description: "Get detailed information about a specific node in the graph. This tool must be used in conjunction with the list_graphs tool, as the nodeId must be obtained from the list_graphs response.\n" +
    "Use cases:\n" +
    "1. View complete node attributes\n" +
    "2. Check associated resources (SVG/Markdown)\n" +
    "3. Analyze node relationships with others\n" +
    "4. Check current state before modifying a node\n\n" +
    "Usage recommendations:\n" +
    "1. First call list_graphs to get the node list of the target graph\n" +
    "2. Get the required nodeId from the returned nodes array\n" +
    "3. Use the obtained graphId and nodeId to call this tool\n" +
    "4. Check the returned relationship data to determine if further action is needed\n\n" +
    "Return data:\n" +
    "- data: Node details\n" +
    "  * id: Node ID\n" +
    "  * name: Node name\n" +
    "  * type: Node type\n" +
    "  * description: Node description\n" +
    "  * filePath: Associated file path\n" +
    "  * metadata: Node metadata\n" +
    "  * resources: Associated resource list\n" +
    "    - id: Resource ID\n" +
    "    - type: Resource type (svg/markdown)\n" +
    "    - title: Resource title\n" +
    "  * relationships: Relationship list\n" +
    "    - id: Edge ID\n" +
    "    - type: Edge type\n" +
    "    - targetNode: Target node information",
  inputSchema: {
    type: "object",
    properties: {
      graphId: {
        type: "string",
        description: "Graph ID, must be obtained from list_graphs response"
      },
      nodeId: {
        type: "string",
        description: "Node ID, must be obtained from the nodes array in list_graphs response"
      }
    },
    required: ["graphId", "nodeId"]
  }
};

const GET_CREATION_GUIDELINES_TOOL: Tool = {
  name: "get_creation_guidelines",
  description: "Get creation guidelines and standards for SVG graphics and Markdown documents. This tool is a prerequisite for the save_resource tool and must be called before creating and saving any resources.\n" +
    "Use cases:\n" +
    "1. Get drawing standards before creating SVG visualizations\n" +
    "2. Get format requirements before creating Markdown documents\n" +
    "3. Get complete guidelines before batch resource creation\n\n" +
    "Usage recommendations:\n" +
    "1. Call this tool before starting any resource creation\n" +
    "2. Carefully read and follow the naming rules and directory structure\n" +
    "3. Create resources according to guidelines, then use save_resource tool\n" +
    "4. Recommended to save guidelines for team reference\n\n" +
    "Return data:\n" +
    "- data: Guidelines content\n" +
    "  * guidelines: Guidelines text content\n" +
    "    - File naming rules\n" +
    "    - Directory structure requirements\n" +
    "    - Format specifications\n" +
    "    - Style guide\n" +
    "  * type: Guidelines type (svg/markdown/all)\n" +
    "  * version: Guidelines version",
  inputSchema: {
    type: "object",
    properties: {
      type: {
        type: "string",
        enum: ["svg", "markdown", "all"],
        description: "Guidelines type:\n" +
          "- svg: SVG graphics creation guidelines, including drawing style, naming rules, etc.\n" +
          "- markdown: Markdown document guidelines, including format requirements, directory structure, etc.\n" +
          "- all: Get all guidelines (recommended)"
      }
    },
    required: ["type"]
  }
};

const SAVE_RESOURCE_TOOL: Tool = {
  name: "save_resource",
  description: "Save AI-generated SVG graphics or Markdown documents to the knowledge graph. This tool must be used in conjunction with get_creation_guidelines and list_graphs tools.\n" +
    "Use cases:\n" +
    "1. Save SVG visualization representation of the graph\n" +
    "2. Save Markdown documents related to nodes\n" +
    "3. Batch save multiple resource files\n\n" +
    "Usage recommendations:\n" +
    "1. First call get_creation_guidelines to get resource creation standards\n" +
    "2. Use list_graphs to get target graph ID and node ID (if needed)\n" +
    "3. Create resource content according to standards\n" +
    "4. Use this tool to save the resource\n" +
    "5. After saving, use get_node_details to check resource association status\n\n" +
    "Return data:\n" +
    "- data: Saved resource information\n" +
    "  * id: Resource ID\n" +
    "  * type: Resource type (svg/markdown)\n" +
    "  * title: Resource title\n" +
    "  * description: Resource description\n" +
    "  * nodeId: Associated node ID (if any)\n" +
    "  * createdAt: Creation time",
  inputSchema: {
    type: "object",
    properties: {
      graphId: {
        type: "string",
        description: "Graph ID, must be obtained from list_graphs return data"
      },
      resourceType: {
        type: "string",
        enum: ["svg", "markdown"],
        description: "Resource type:\n" +
          "- svg: SVG graphics file\n" +
          "- markdown: Markdown document"
      },
      title: {
        type: "string",
        description: "Resource title, must comply with naming rules in get_creation_guidelines"
      },
      content: {
        type: "string",
        description: "Resource content, must comply with format specifications in get_creation_guidelines"
      },
      description: {
        type: "string",
        description: "Resource description (optional)"
      },
      nodeId: {
        type: "string",
        description: "Associated node ID (optional), if provided must be obtained from nodes array in list_graphs"
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
  description: "Modify nodes in the knowledge graph. This tool must be used in conjunction with list_graphs and get_node_details tools.\n" +
    "Use cases:\n" +
    "1. Update basic node information (name, description, etc.)\n" +
    "2. Update file paths associated with nodes\n" +
    "3. Update node metadata information\n\n" +
    "Usage recommendations:\n" +
    "1. First call list_graphs to get target graph and node ID\n" +
    "2. Use get_node_details to check current node status\n" +
    "3. Only update fields that need to be modified, keep others unchanged\n" +
    "4. After updating, call get_node_details again to confirm changes\n\n" +
    "Return data:\n" +
    "- data: Updated node information\n" +
    "  * id: Node ID\n" +
    "  * name: Node name\n" +
    "  * type: Node type\n" +
    "  * description: Node description\n" +
    "  * filePath: Associated file path\n" +
    "  * metadata: Node metadata\n" +
    "  * updatedAt: Update time",
  inputSchema: {
    type: "object",
    properties: {
      graphId: {
        type: "string",
        description: "Graph ID, must be obtained from list_graphs return data"
      },
      nodeId: {
        type: "string",
        description: "Node ID, must be obtained from nodes array in list_graphs"
      },
      name: {
        type: "string",
        description: "New node name (optional)"
      },
      description: {
        type: "string",
        description: "New node description (optional)"
      },
      filePath: {
        type: "string",
        description: "New associated file path (optional)"
      },
      metadata: {
        type: "object",
        description: "New node metadata (optional)"
      }
    },
    required: ["graphId", "nodeId"]
  }
};

const UPDATE_EDGE_TOOL: Tool = {
  name: "update_edge",
  description: "Modify edges in the knowledge graph. This tool must be used in conjunction with list_graphs and get_node_details tools.\n" +
    "Use cases:\n" +
    "1. Update edge label information\n" +
    "2. Adjust edge weight values\n" +
    "3. Update edge metadata information\n\n" +
    "Usage recommendations:\n" +
    "1. First call list_graphs to get target graph information\n" +
    "2. Use get_node_details to view edge list of related nodes\n" +
    "3. Only update fields that need to be modified, keep others unchanged\n" +
    "4. After updating, call get_node_details again to confirm changes\n\n" +
    "Return data:\n" +
    "- data: Updated edge information\n" +
    "  * id: Edge ID\n" +
    "  * type: Edge type\n" +
    "  * sourceId: Source node ID\n" +
    "  * targetId: Target node ID\n" +
    "  * label: Edge label\n" +
    "  * weight: Edge weight\n" +
    "  * metadata: Edge metadata\n" +
    "  * updatedAt: Update time",
  inputSchema: {
    type: "object",
    properties: {
      graphId: {
        type: "string",
        description: "Graph ID, must be obtained from list_graphs return data"
      },
      edgeId: {
        type: "string",
        description: "Edge ID, must be obtained from relationships array in get_node_details"
      },
      label: {
        type: "string",
        description: "New edge label (optional)"
      },
      weight: {
        type: "number",
        description: "New edge weight (optional), used to represent relationship strength"
      },
      metadata: {
        type: "object",
        description: "New edge metadata (optional)"
      }
    },
    required: ["graphId", "edgeId"]
  }
};

const DELETE_NODE_TOOL: Tool = {
  name: "delete_node",
  description: "Delete nodes from the knowledge graph. This tool must be used in conjunction with list_graphs tool, and the operation cannot be undone.\n" +
    "Use cases:\n" +
    "1. Delete incorrectly created nodes\n" +
    "2. Delete nodes that are no longer needed\n" +
    "3. Delete redundant nodes when restructuring the graph\n\n" +
    "Usage recommendations:\n" +
    "1. First call list_graphs to get target graph and node information\n" +
    "2. Use get_node_details to check node's associated resources and relationships\n" +
    "3. Confirm deletion won't affect other important nodes\n" +
    "4. Set confirmDelete to true to confirm deletion\n" +
    "5. Recommended to backup important data before deletion\n\n" +
    "Important notes:\n" +
    "- Deleting a node will also delete all edges related to that node\n" +
    "- If the node has associated resources, they won't be deleted but will be unlinked\n\n" +
    "Return data:\n" +
    "- data: Deletion result\n" +
    "  * id: Deleted node ID\n" +
    "  * name: Node name\n" +
    "  * type: Node type\n" +
    "  * deletedAt: Deletion time",
  inputSchema: {
    type: "object",
    properties: {
      graphId: {
        type: "string",
        description: "Graph ID, must be obtained from list_graphs return data"
      },
      nodeId: {
        type: "string",
        description: "Node ID, must be obtained from nodes array in list_graphs"
      },
      confirmDelete: {
        type: "boolean",
        description: "Confirm deletion, must be set to true, this is a safety measure to prevent accidental deletion"
      }
    },
    required: ["graphId", "nodeId", "confirmDelete"]
  }
};

const DELETE_EDGE_TOOL: Tool = {
  name: "delete_edge",
  description: "Delete edges from the knowledge graph. This tool must be used in conjunction with list_graphs and get_node_details tools, and the operation cannot be undone.\n" +
    "Use cases:\n" +
    "1. Delete incorrectly created relationships\n" +
    "2. Update relationship structure between nodes\n" +
    "3. Clean up redundant relationships when restructuring the graph\n\n" +
    "Usage recommendations:\n" +
    "1. First call list_graphs to get target graph information\n" +
    "2. Use get_node_details to get edge details\n" +
    "3. Confirm deletion won't break important relationship structures\n" +
    "4. Set confirmDelete to true to confirm deletion\n\n" +
    "Important notes:\n" +
    "- Deleting edges won't affect related nodes\n" +
    "- Need to call get_node_details again to view updated relationships\n\n" +
    "Return data:\n" +
    "- data: Deletion result\n" +
    "  * id: Deleted edge ID\n" +
    "  * deletedAt: Deletion time",
  inputSchema: {
    type: "object",
    properties: {
      graphId: {
        type: "string",
        description: "Graph ID, must be obtained from list_graphs return data"
      },
      edgeId: {
        type: "string",
        description: "Edge ID, must be obtained from relationships array in get_node_details"
      },
      confirmDelete: {
        type: "boolean",
        description: "Confirm deletion, must be set to true, this is a safety measure to prevent accidental deletion"
      }
    },
    required: ["graphId", "edgeId", "confirmDelete"]
  }
};

const UPDATE_RESOURCE_TOOL: Tool = {
  name: "update_resource",
  description: "Update resource information in the knowledge graph. This tool must be used in conjunction with list_graphs and get_node_details tools.\n" +
    "Use cases:\n" +
    "1. Modify resource title or description\n" +
    "2. Update resource metadata information\n" +
    "3. Improve resource documentation\n\n" +
    "Usage recommendations:\n" +
    "1. First call list_graphs to get target graph information\n" +
    "2. Use get_node_details to check current resource information\n" +
    "3. Only update fields that need to be modified\n" +
    "4. Maintain consistency in resource naming\n\n" +
    "Return data:\n" +
    "- data: Updated resource information\n" +
    "  * id: Resource ID\n" +
    "  * name: Resource name\n" +
    "  * title: Resource title\n" +
    "  * description: Resource description\n" +
    "  * updatedAt: Update time",
  inputSchema: {
    type: "object",
    properties: {
      graphId: {
        type: "string",
        description: "Graph ID, must be obtained from list_graphs return data"
      },
      resourceId: {
        type: "string",
        description: "Resource ID, must be obtained from resources array in get_node_details"
      },
      name: {
        type: "string",
        description: "New resource name (optional)"
      },
      title: {
        type: "string",
        description: "New resource title (optional)"
      },
      description: {
        type: "string",
        description: "New resource description (optional)"
      }
    },
    required: ["graphId", "resourceId"]
  }
};

const DELETE_RESOURCE_TOOL: Tool = {
  name: "delete_resource",
  description: "Delete resources from the knowledge graph. This tool must be used in conjunction with list_graphs and get_node_details tools, and the operation cannot be undone.\n" +
    "Use cases:\n" +
    "1. Delete outdated resource files\n" +
    "2. Clean up unnecessary documents\n" +
    "3. Remove incorrectly created resources\n\n" +
    "Usage recommendations:\n" +
    "1. First call list_graphs to get target graph information\n" +
    "2. Use get_node_details to confirm resource associations\n" +
    "3. Confirm deletion won't affect other nodes\n" +
    "4. Set confirmDelete to true to confirm deletion\n" +
    "5. Recommended to backup important resources before deletion\n\n" +
    "Important notes:\n" +
    "- Deleting a resource will also delete the physical file\n" +
    "- Will automatically unlink from all nodes\n" +
    "- This operation cannot be recovered\n\n" +
    "Return data:\n" +
    "- data: Deletion result\n" +
    "  * id: Deleted resource ID\n" +
    "  * type: Resource type\n" +
    "  * deletedAt: Deletion time",
  inputSchema: {
    type: "object",
    properties: {
      graphId: {
        type: "string",
        description: "Graph ID, must be obtained from list_graphs return data"
      },
      resourceId: {
        type: "string",
        description: "Resource ID, must be obtained from resources array in get_node_details"
      },
      confirmDelete: {
        type: "boolean",
        description: "Confirm deletion, must be set to true, this is a safety measure to prevent accidental deletion"
      }
    },
    required: ["graphId", "resourceId", "confirmDelete"]
  }
};

const UNLINK_RESOURCE_TOOL: Tool = {
  name: "unlink_resource",
  description: "Unlink resource associations from nodes. This tool must be used in conjunction with list_graphs and get_node_details tools.\n" +
    "Use cases:\n" +
    "1. Adjust resource associations\n" +
    "2. Remove incorrect resource associations\n" +
    "3. Reorganize node resource structure\n\n" +
    "Usage recommendations:\n" +
    "1. First call list_graphs to get target graph information\n" +
    "2. Use get_node_details to view node's resource associations\n" +
    "3. Confirm unlinking won't affect other functionality\n" +
    "4. Record changes for potential re-association\n\n" +
    "Important notes:\n" +
    "- Only removes association, does not delete resource\n" +
    "- Resource can still be used by other nodes\n" +
    "- Association can be re-established at any time\n\n" +
    "Return data:\n" +
    "- data: Operation result\n" +
    "  * resourceId: Resource ID\n" +
    "  * nodeId: Node ID\n" +
    "  * unlinkedAt: Time when association was removed",
  inputSchema: {
    type: "object",
    properties: {
      graphId: {
        type: "string",
        description: "Graph ID, must be obtained from list_graphs return data"
      },
      nodeId: {
        type: "string",
        description: "Node ID, must be obtained from nodes array in list_graphs"
      },
      resourceId: {
        type: "string",
        description: "Resource ID to unlink, must be obtained from resources array in get_node_details"
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
