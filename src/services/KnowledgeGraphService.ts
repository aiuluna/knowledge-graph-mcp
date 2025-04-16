import { Graph, GraphStatus, Node, Edge, Resource, NodeType, EdgeType, GraphModel, GraphType, SimpleGraph } from '../models/Graph';
import { FileService } from './FileService';
import { KnowledgeGraphConfig } from '../config/types';
import { SvgService } from './SvgService';
import { formatLocalDateTime } from '../utils/datetime';
import { z } from 'zod';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as fsSync from 'node:fs';

export class KnowledgeGraphError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KnowledgeGraphError';
  }
}

export class KnowledgeGraphService {
  private graphs: Map<string, Graph> = new Map();
  private fileService?: FileService;
  private svgService: SvgService;
  private initialized = false;
  private config: KnowledgeGraphConfig;

  constructor(config?: KnowledgeGraphConfig) {
    this.config = config || {
      autoCreate: true,
      autoPersist: true,
      generateSvg: true,
      svgSettings: {
        width: 1200,
        height: 800,
        nodeRadius: 20,
        fontSize: 12,
        fontFamily: 'Arial',
        colors: {
          component: '#4285F4',
          module: '#EA4335',
          service: '#FBBC05',
          data: '#34A853',
          api: '#8E44AD',
          concept: '#E67E22',
          resource: '#16A085',
          default: '#95A5A6'
        }
      }
    };
    if (config?.graphDir) {
      this.fileService = new FileService(config.graphDir);
    }
    this.svgService = new SvgService(config?.svgSettings);
  }

  async init(): Promise<void> {
    console.log('初始化KnowledgeGraphService...');
    if (this.fileService) {
      console.log(`使用图谱目录: ${this.fileService.getGraphDir()}`);
      await this.fileService.init();
      await this.reloadData();
      this.initialized = true;
      console.log('KnowledgeGraphService初始化完成');
    } else {
      console.warn('未配置文件服务，将使用内存模式运行');
      this.initialized = true;
    }
  }

  private async reloadData(): Promise<void> {
    if (!this.fileService) return;

    try {
      console.log('开始重新加载图谱数据...');
      // 使用fileService.loadGraphs方法而不是readGraphFile
      const data = await this.fileService.loadGraphs();

      console.log(`加载到${data.graphs?.length || 0}个图谱数据`);

      if (data.graphs && Array.isArray(data.graphs)) {
        this.graphs.clear();
        data.graphs.forEach((graph: any) => {
          // 转换日期字符串为Date对象
          graph.createdAt = new Date(graph.createdAt);
          graph.updatedAt = new Date(graph.updatedAt);
          if (graph.publishedAt) graph.publishedAt = new Date(graph.publishedAt);
          if (graph.archivedAt) graph.archivedAt = new Date(graph.archivedAt);

          // 处理节点的日期
          graph.nodes?.forEach((node: any) => {
            node.createdAt = new Date(node.createdAt);
            node.updatedAt = new Date(node.updatedAt);
          });

          // 处理边的日期
          graph.edges?.forEach((edge: any) => {
            edge.createdAt = new Date(edge.createdAt);
            edge.updatedAt = new Date(edge.updatedAt);
          });

          // 处理资源的日期
          graph.resources?.forEach((resource: any) => {
            resource.createdAt = new Date(resource.createdAt);
            resource.updatedAt = new Date(resource.updatedAt);
          });

          console.log(`加载图谱: ${graph.id} - ${graph.name}`);
          this.graphs.set(graph.id, graph);
        });
        console.log(`共加载了${this.graphs.size}个图谱到内存`);
      } else {
        console.log('没有找到有效的图谱数据');
      }
    } catch (error) {
      console.error('重新加载图谱数据失败:', error);
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.init();
    } else if (this.graphs.size === 0 && this.fileService) {
      // 如果 map 为空但文件服务存在，尝试重新加载数据
      await this.reloadData();
    }
  }

  // 创建新的知识图谱
  async createGraph(name: string, type?: typeof GraphType[keyof typeof GraphType], description?: string): Promise<Graph> {
    try {
      if (!name || typeof name !== 'string') {
        throw new KnowledgeGraphError(`创建图谱失败: name必须提供且类型为字符串，当前类型: ${typeof name}, 值: ${JSON.stringify(name)}`);
      }

      // 检查type参数，如果提供了但不是有效类型则抛出错误
      if (type && !Object.values(GraphType).includes(type as any)) {
        throw new KnowledgeGraphError(`创建图谱失败: 无效的图谱类型 "${type}"。有效类型: ${Object.values(GraphType).join(', ')}`);
      }

      // 检查description参数
      if (description && typeof description !== 'string') {
        throw new KnowledgeGraphError(`创建图谱失败: description必须为字符串类型，当前类型: ${typeof description}`);
      }

      await this.ensureInitialized();
      const graph = GraphModel.create(name, type, description);
      this.graphs.set(graph.id, graph);
      await this.persistChanges();
      return graph;
    } catch (error) {
      console.error('创建图谱错误:', error);
      if (error instanceof KnowledgeGraphError) {
        throw error;
      } else {
        const errorMsg = error instanceof Error ? error.message : String(error);
        throw new KnowledgeGraphError(`创建图谱时发生未知错误: ${errorMsg}`);
      }
    }
  }

  // 获取知识图谱
  async getGraph(id: string): Promise<Graph> {
    await this.ensureInitialized();
    const graph = this.graphs.get(id);
    if (!graph) {
      throw new KnowledgeGraphError(`知识图谱 ${id} 不存在`);
    }
    return graph;
  }

  // 更新知识图谱基本信息
  async updateGraph(id: string, updates: { name?: string; description?: string }): Promise<Graph> {
    await this.ensureInitialized();
    const graph = await this.getGraph(id);

    if (graph.status === GraphStatus.ARCHIVED) {
      throw new KnowledgeGraphError('已归档的知识图谱不能修改');
    }

    if (updates.name) {
      graph.name = updates.name;
    }

    if (updates.description !== undefined) {
      graph.description = updates.description;
    }

    graph.updatedAt = new Date();
    this.graphs.set(id, graph);
    await this.persistChanges();
    return graph;
  }

  // 发布知识图谱
  async publishGraph(id: string): Promise<Graph> {
    await this.ensureInitialized();
    const graph = await this.getGraph(id);

    if (graph.status === GraphStatus.ARCHIVED) {
      throw new KnowledgeGraphError('已归档的知识图谱不能发布');
    }

    graph.status = GraphStatus.PUBLISHED;
    graph.publishedAt = new Date();
    graph.updatedAt = new Date();

    // 生成SVG图表
    if (this.config.generateSvg && this.fileService) {
      const svgContent = this.svgService.generateGraphSvg(graph);

      // 生成基础文件名和后缀
      const baseName = graph.name.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]+/g, '_');
      const suffix = `graph_${id.slice(0, 8)}`;

      // 生成带时间的文件名
      const fileName = `${this.generateFileNameWithTime(baseName, suffix)}.svg`;

      const svgPath = await this.fileService.saveSvg(id, fileName, svgContent);

      // 添加SVG资源
      const resource = GraphModel.createResource(
        `${graph.name} 知识图谱`,
        'svg',
        `resources/svg/${svgPath}`,
        '自动生成的知识图谱可视化图'
      );
      graph.resources.push(resource);
    }

    this.graphs.set(id, graph);
    await this.persistChanges();
    return graph;
  }

  // 归档知识图谱
  async archiveGraph(id: string): Promise<Graph> {
    await this.ensureInitialized();
    const graph = await this.getGraph(id);

    graph.status = GraphStatus.ARCHIVED;
    graph.archivedAt = new Date();
    graph.updatedAt = new Date();
    this.graphs.set(id, graph);
    await this.persistChanges();
    return graph;
  }

  // 删除知识图谱
  async deleteGraph(id: string): Promise<void> {
    await this.ensureInitialized();

    // 先检查图谱是否存在
    const graph = await this.getGraph(id);

    // 删除图谱相关的所有资源文件
    if (this.fileService) {
      // 删除相关的SVG文件
      const svgResources = graph.resources.filter(r => r.type === 'svg');
      for (const resource of svgResources) {
        try {
          // 从路径中提取文件名
          const fileName = resource.path.split('/').pop();
          if (fileName) {
            await this.fileService.deleteSvg(fileName);
          }
        } catch (error) {
          console.error(`删除SVG资源失败: ${error}`);
          // 继续删除其他资源
        }
      }

      // 删除相关的MD文件
      const mdResources = graph.resources.filter(r => r.type === 'md');
      for (const resource of mdResources) {
        try {
          // 从路径中提取文件名
          const fileName = resource.path.split('/').pop();
          if (fileName) {
            await this.fileService.deleteMd(fileName);
          }
        } catch (error) {
          console.error(`删除MD资源失败: ${error}`);
          // 继续删除其他资源
        }
      }
    }

    // 从内存中删除图谱
    this.graphs.delete(id);

    // 持久化更改
    await this.persistChanges();

    console.log(`已删除知识图谱: ${graph.name} (${id})`);
  }

  // 添加节点
  async addNode(graphId: string, nodeType: typeof NodeType[keyof typeof NodeType], name: string, description?: string, filePath?: string, metadata?: Record<string, any>): Promise<Node> {
    await this.ensureInitialized();
    const graph = await this.getGraph(graphId);

    // 验证节点类型与图谱类型是否匹配
    this.validateNodeTypeForGraphType(graph.type, nodeType);

    if (graph.status === GraphStatus.ARCHIVED) {
      throw new KnowledgeGraphError('已归档的知识图谱不能添加节点');
    }

    // 检查节点名称是否重复
    if (graph.nodes.some(n => n.name === name)) {
      throw new KnowledgeGraphError(`节点名称 "${name}" 已存在`);
    }

    const node = GraphModel.createNode(nodeType, name, description, filePath, metadata);
    graph.nodes.push(node);
    graph.updatedAt = new Date();
    this.graphs.set(graphId, graph);
    await this.persistChanges();
    return node;
  }

  // 更新节点
  async updateNode(graphId: string, nodeId: string, updates: { name?: string; description?: string; filePath?: string; metadata?: Record<string, any> }): Promise<Node> {
    await this.ensureInitialized();
    const graph = await this.getGraph(graphId);

    if (graph.status === GraphStatus.ARCHIVED) {
      throw new KnowledgeGraphError('已归档的知识图谱不能修改节点');
    }

    const nodeIndex = graph.nodes.findIndex(n => n.id === nodeId);
    if (nodeIndex === -1) {
      throw new KnowledgeGraphError(`节点 ${nodeId} 不存在`);
    }

    const node = graph.nodes[nodeIndex];

    if (updates.name && updates.name !== node.name) {
      // 检查新名称是否重复
      if (graph.nodes.some(n => n.name === updates.name && n.id !== nodeId)) {
        throw new KnowledgeGraphError(`节点名称 "${updates.name}" 已存在`);
      }
      node.name = updates.name;
    }

    if (updates.description !== undefined) {
      node.description = updates.description;
    }

    if (updates.filePath !== undefined) {
      node.filePath = updates.filePath;
    }

    if (updates.metadata !== undefined) {
      node.metadata = updates.metadata;
    }

    node.updatedAt = new Date();
    graph.updatedAt = new Date();
    this.graphs.set(graphId, graph);
    await this.persistChanges();
    return node;
  }

  // 删除节点
  async deleteNode(graphId: string, nodeId: string): Promise<void> {
    await this.ensureInitialized();
    const graph = await this.getGraph(graphId);

    if (graph.status === GraphStatus.ARCHIVED) {
      throw new KnowledgeGraphError('已归档的知识图谱不能删除节点');
    }

    const nodeIndex = graph.nodes.findIndex(n => n.id === nodeId);
    if (nodeIndex === -1) {
      throw new KnowledgeGraphError(`节点 ${nodeId} 不存在`);
    }

    // 检查是否是根节点
    if (graph.rootNodeId === nodeId) {
      throw new KnowledgeGraphError('不能删除根节点');
    }

    // 删除与节点相关的边
    graph.edges = graph.edges.filter(e => e.source !== nodeId && e.target !== nodeId);

    // 删除节点
    graph.nodes.splice(nodeIndex, 1);
    graph.updatedAt = new Date();
    this.graphs.set(graphId, graph);
    await this.persistChanges();
  }

  // 添加边
  async addEdge(graphId: string, edgeType: typeof EdgeType[keyof typeof EdgeType], source: string, target: string, label?: string, weight?: number, metadata?: Record<string, any>): Promise<Edge> {
    await this.ensureInitialized();
    const graph = await this.getGraph(graphId);

    // 验证边类型与图谱类型是否匹配
    this.validateEdgeTypeForGraphType(graph.type, edgeType);

    if (graph.status === GraphStatus.ARCHIVED) {
      throw new KnowledgeGraphError('已归档的知识图谱不能添加边');
    }

    // 验证源节点和目标节点是否存在
    const sourceNode = graph.nodes.find(n => n.id === source);
    const targetNode = graph.nodes.find(n => n.id === target);

    if (!sourceNode) {
      throw new KnowledgeGraphError(`源节点 ${source} 不存在`);
    }

    if (!targetNode) {
      throw new KnowledgeGraphError(`目标节点 ${target} 不存在`);
    }

    // 检查是否已存在相同的边
    if (graph.edges.some(e => e.source === source && e.target === target && e.type === edgeType)) {
      throw new KnowledgeGraphError(`从 ${source} 到 ${target} 的 ${edgeType} 类型边已存在`);
    }

    const edge = GraphModel.createEdge(edgeType, source, target, label, weight, metadata);
    graph.edges.push(edge);
    graph.updatedAt = new Date();
    this.graphs.set(graphId, graph);
    await this.persistChanges();
    return edge;
  }

  // 更新边
  async updateEdge(graphId: string, edgeId: string, updates: { label?: string; weight?: number; metadata?: Record<string, any> }): Promise<Edge> {
    await this.ensureInitialized();
    const graph = await this.getGraph(graphId);

    if (graph.status === GraphStatus.ARCHIVED) {
      throw new KnowledgeGraphError('已归档的知识图谱不能修改边');
    }

    const edgeIndex = graph.edges.findIndex(e => e.id === edgeId);
    if (edgeIndex === -1) {
      throw new KnowledgeGraphError(`边 ${edgeId} 不存在`);
    }

    const edge = graph.edges[edgeIndex];

    if (updates.label !== undefined) {
      edge.label = updates.label;
    }

    if (updates.weight !== undefined) {
      edge.weight = updates.weight;
    }

    if (updates.metadata !== undefined) {
      edge.metadata = updates.metadata;
    }

    edge.updatedAt = new Date();
    graph.updatedAt = new Date();
    this.graphs.set(graphId, graph);
    await this.persistChanges();
    return edge;
  }

  // 删除边
  async deleteEdge(graphId: string, edgeId: string): Promise<void> {
    await this.ensureInitialized();
    const graph = await this.getGraph(graphId);

    if (graph.status === GraphStatus.ARCHIVED) {
      throw new KnowledgeGraphError('已归档的知识图谱不能删除边');
    }

    const edgeIndex = graph.edges.findIndex(e => e.id === edgeId);
    if (edgeIndex === -1) {
      throw new KnowledgeGraphError(`边 ${edgeId} 不存在`);
    }

    graph.edges.splice(edgeIndex, 1);
    graph.updatedAt = new Date();
    this.graphs.set(graphId, graph);
    await this.persistChanges();
  }

  // 添加资源
  async addResource(graphId: string, name: string, type: string, content: Buffer | string, description?: string): Promise<Resource> {
    await this.ensureInitialized();
    const graph = await this.getGraph(graphId);

    if (graph.status === GraphStatus.ARCHIVED) {
      throw new KnowledgeGraphError('已归档的知识图谱不能添加资源');
    }

    // 检查资源名称是否重复
    if (graph.resources.some(r => r.name === name)) {
      throw new KnowledgeGraphError(`资源名称 "${name}" 已存在`);
    }

    const resource = GraphModel.createResource(name, type, '', description);

    if (this.fileService) {
      // 保存资源文件
      const relativePath = await this.fileService.saveResource(resource.id, type, content);
      // 更新资源路径
      resource.path = `resources/${resource.id}.${type}`;
    } else {
      throw new KnowledgeGraphError('无法保存资源文件：文件服务未初始化');
    }

    graph.resources.push(resource);
    graph.updatedAt = new Date();
    this.graphs.set(graphId, graph);
    await this.persistChanges();
    return resource;
  }

  // 将资源关联到节点
  async linkResourceToNode(graphId: string, nodeId: string, resourceId: string): Promise<Node> {
    await this.ensureInitialized();
    const graph = await this.getGraph(graphId);

    if (graph.status === GraphStatus.ARCHIVED) {
      throw new KnowledgeGraphError('已归档的知识图谱不能修改节点');
    }

    // 检查节点是否存在
    const nodeIndex = graph.nodes.findIndex(n => n.id === nodeId);
    if (nodeIndex === -1) {
      throw new KnowledgeGraphError(`节点 ${nodeId} 不存在`);
    }

    // 检查资源是否存在
    if (!graph.resources.some(r => r.id === resourceId)) {
      throw new KnowledgeGraphError(`资源 ${resourceId} 不存在`);
    }

    const node = graph.nodes[nodeIndex];

    // 确保resources数组存在
    if (!node.resources) {
      node.resources = [];
    }

    // 检查是否已关联
    if (node.resources.includes(resourceId)) {
      throw new KnowledgeGraphError(`资源 ${resourceId} 已关联到节点 ${nodeId}`);
    }

    node.resources.push(resourceId);
    node.updatedAt = new Date();
    graph.updatedAt = new Date();
    this.graphs.set(graphId, graph);
    await this.persistChanges();
    return node;
  }

  // 从节点移除资源关联
  async unlinkResourceFromNode(graphId: string, nodeId: string, resourceId: string): Promise<void> {
    await this.ensureInitialized();
    const graph = await this.getGraph(graphId);

    if (graph.status === GraphStatus.ARCHIVED) {
      throw new KnowledgeGraphError('已归档的知识图谱不能修改节点');
    }

    // 检查节点是否存在
    const nodeIndex = graph.nodes.findIndex(n => n.id === nodeId);
    if (nodeIndex === -1) {
      throw new KnowledgeGraphError(`节点 ${nodeId} 不存在`);
    }

    const node = graph.nodes[nodeIndex];

    // 确保resources数组存在
    if (!node.resources || !node.resources.includes(resourceId)) {
      throw new KnowledgeGraphError(`资源 ${resourceId} 未关联到节点 ${nodeId}`);
    }

    node.resources = node.resources.filter(id => id !== resourceId);
    node.updatedAt = new Date();
    graph.updatedAt = new Date();
    this.graphs.set(graphId, graph);
    await this.persistChanges();
  }

  // 列出所有知识图谱
  async listGraphs(status?: string): Promise<SimpleGraph[]> {
    await this.ensureInitialized();
    let graphs = Array.from(this.graphs.values());

    if (status) {
      graphs = graphs.filter(g => g.status === status);
    }

    // 为每个图谱添加简化的节点列表信息
    return graphs.map(graph => ({
      ...graph,
      nodes: graph.nodes?.map(node => ({
        id: node.id,
        name: node.name,
        type: node.type
      })) || []
    }));
  }

  // 获取节点详情
  async getNodeDetails(graphId: string, nodeId: string): Promise<{
    node: Node;
    incomingEdges: Edge[];
    outgoingEdges: Edge[];
    resources: Resource[];
  }> {
    await this.ensureInitialized();
    const graph = await this.getGraph(graphId);

    const node = graph.nodes.find(n => n.id === nodeId);
    if (!node) {
      throw new KnowledgeGraphError(`节点 ${nodeId} 不存在`);
    }

    // 获取与节点相关的边
    const incomingEdges = graph.edges.filter(e => e.target === nodeId);
    const outgoingEdges = graph.edges.filter(e => e.source === nodeId);

    // 获取节点关联的资源
    const resources: Resource[] = [];
    if (node.resources && node.resources.length > 0) {
      for (const resourceId of node.resources) {
        const resource = graph.resources.find(r => r.id === resourceId);
        if (resource) {
          resources.push(resource);
        }
      }
    }

    return {
      node,
      incomingEdges,
      outgoingEdges,
      resources
    };
  }

  // 生成带有可读时间格式的文件名
  private generateFileNameWithTime(baseName: string, suffix: string): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    // 格式: 基础名称_后缀_年月日_时分.扩展名
    return `${baseName}_${suffix}_${year}${month}${day}_${hours}${minutes}`;
  }

  // 保存Markdown文档到知识图谱
  async saveMdToGraph(id: string, nodeId: string | null, title: string, content: string, description: string = ''): Promise<void> {
    await this.ensureInitialized();
    const graph = await this.getGraph(id);

    if (!this.fileService) {
      throw new KnowledgeGraphError('文件服务未配置，无法保存Markdown文档');
    }

    // 生成基础文件名和后缀
    const baseName = title.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]+/g, '_');
    const suffix = nodeId ? `node_${nodeId.slice(0, 8)}` : `graph_${id.slice(0, 8)}`;

    // 生成带时间的文件名
    const fileName = `${this.generateFileNameWithTime(baseName, suffix)}.md`;

    // 保存文档
    await this.fileService.saveMd(id, fileName, content);

    // 创建资源记录
    if (!graph.resources) {
      graph.resources = [];
    }

    const resourceData = {
      id: `res_${Date.now()}`,
      name: title,
      type: 'markdown',
      title,
      description: description || title,
      path: `resources/md/${fileName}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    graph.resources.push(resourceData);

    // 如果指定了节点，将资源关联到该节点
    if (nodeId) {
      const node = graph.nodes?.find(n => n.id === nodeId);
      if (!node) {
        throw new KnowledgeGraphError(`节点 ${nodeId} 不存在`);
      }

      if (!node.resources) {
        node.resources = [];
      }

      node.resources.push(resourceData.id);
      node.updatedAt = new Date();
    }

    graph.updatedAt = new Date();
    await this.persistChanges();
  }

  // 关联Markdown文档到图谱 (为向后兼容保留的别名方法)
  async linkMdToGraph(id: string, nodeId: string | null, title: string, content: string, description: string = ''): Promise<void> {
    return this.saveMdToGraph(id, nodeId, title, content, description);
  }

  // 保存SVG到节点
  async saveSvgToNode(id: string, nodeId: string, title: string, description: string = '', svgContent: string): Promise<void> {
    await this.ensureInitialized();
    const graph = await this.getGraph(id);
    const node = graph.nodes?.find(n => n.id === nodeId);

    if (!node) {
      throw new KnowledgeGraphError(`节点 ${nodeId} 不存在`);
    }

    if (!this.fileService) {
      throw new KnowledgeGraphError('文件服务未配置，无法保存SVG');
    }

    // 确保SVG内容有效
    if (!svgContent || typeof svgContent !== 'string' || !svgContent.trim().startsWith('<svg')) {
      throw new KnowledgeGraphError('无效的SVG内容');
    }

    // 生成基础文件名和后缀
    const baseName = title.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]+/g, '_');
    const suffix = `node_${nodeId.slice(0, 8)}`;

    // 生成带时间的文件名
    const fileName = `${this.generateFileNameWithTime(baseName, suffix)}.svg`;

    // 保存SVG
    await this.fileService.saveSvg(id, fileName, svgContent);

    // 创建资源记录
    if (!graph.resources) {
      graph.resources = [];
    }

    const resourceData = {
      id: `res_${Date.now()}`,
      name: title,
      type: 'svg',
      title,
      description: description || title,
      path: `resources/svg/${fileName}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    graph.resources.push(resourceData);

    // 将资源关联到节点
    if (!node.resources) {
      node.resources = [];
    }

    node.resources.push(resourceData.id);
    node.updatedAt = new Date();

    graph.updatedAt = new Date();
    await this.persistChanges();
  }

  // 关联SVG到节点 (为向后兼容保留的别名方法)
  async linkSvgToNode(id: string, nodeId: string, title: string, description: string = '', useExistingSvg: boolean = false, svgPath: string = ''): Promise<void> {
    // 此方法只是向后兼容的桥接方法，实际使用saveSvgToNode
    if (useExistingSvg) {
      throw new KnowledgeGraphError('新API不再支持使用现有SVG，请提供SVG内容');
    }

    if (!svgPath) {
      throw new KnowledgeGraphError('必须提供SVG路径');
    }

    // 读取SVG内容
    try {
      const svgContent = await fs.readFile(svgPath, 'utf-8');
      return this.saveSvgToNode(id, nodeId, title, description, svgContent);
    } catch (error) {
      throw new KnowledgeGraphError(`无法读取SVG文件: ${error}`);
    }
  }

  // 生成图谱SVG - 保留向后兼容
  async generateGraphSvg(id: string): Promise<string> {
    const data = await this.generateGraphDataForSvg(id);
    // 生成一个非常简单的SVG占位符，实际项目中应由AI或用户根据数据生成完整SVG
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
  <text x="50%" y="50%" text-anchor="middle" font-size="24">
    ${data.name} (请根据规范和数据手动创建完整SVG)
  </text>
</svg>`;
  }

  // 为了支持新的API命名，添加与现有方法功能相同的别名方法
  async saveGraphSvg(id: string, svgContent: string): Promise<void> {
    return this.updateGraphSvg(id, svgContent);
  }

  // 更新知识图谱的SVG可视化
  async updateGraphSvg(id: string, svgContent: string): Promise<void> {
    await this.ensureInitialized();
    const graph = await this.getGraph(id);

    if (!this.fileService) {
      throw new KnowledgeGraphError('文件服务未配置，无法保存SVG');
    }

    // 确保SVG内容有效
    if (!svgContent || typeof svgContent !== 'string' || !svgContent.trim().startsWith('<svg')) {
      throw new KnowledgeGraphError('无效的SVG内容');
    }

    // 生成基础文件名和后缀
    const baseName = graph.name.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]+/g, '_');
    const suffix = `graph_${id.slice(0, 8)}`;

    // 生成带时间的文件名
    const fileName = `${this.generateFileNameWithTime(baseName, suffix)}.svg`;

    await this.fileService.saveSvg(id, fileName, svgContent);

    // 添加资源记录
    if (!graph.resources) {
      graph.resources = [];
    }

    // 检查是否已存在此SVG资源
    const existingIndex = graph.resources.findIndex(r =>
      r.type === 'svg' && r.path.includes(`graph_${id.slice(0, 8)}`)
    );

    const resourceData = {
      id: existingIndex >= 0 ? graph.resources[existingIndex].id : `res_${Date.now()}`,
      name: `${graph.name}图谱可视化`,
      type: 'svg',
      title: '图谱可视化',
      description: `${graph.name} 的SVG可视化表示`,
      path: `resources/svg/${fileName}`,
      createdAt: existingIndex >= 0 ? graph.resources[existingIndex].createdAt : new Date(),
      updatedAt: new Date()
    };

    if (existingIndex >= 0) {
      graph.resources[existingIndex] = resourceData;
    } else {
      graph.resources.push(resourceData);
    }

    graph.updatedAt = new Date();
    await this.persistChanges();
  }

  // 获取知识图谱数据用于创建SVG
  async generateGraphDataForSvg(id: string): Promise<any> {
    await this.ensureInitialized();
    const graph = await this.getGraph(id);

    // 处理节点和边的数据，适合SVG绘制
    const nodes = graph.nodes?.map(node => ({
      id: node.id,
      type: node.type,
      name: node.name,
      description: node.description,
      metadata: node.metadata
    })) || [];

    const edges = graph.edges?.map(edge => ({
      id: edge.id,
      type: edge.type,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      weight: edge.weight
    })) || [];

    // 提供基本布局建议
    const layoutSuggestion = {
      width: 1200,
      height: 800,
      nodeTypes: {
        component: { color: '#4285F4', shape: 'rect', radius: 5 },
        module: { color: '#EA4335', shape: 'rect', radius: 10 },
        service: { color: '#FBBC05', shape: 'hexagon' },
        data: { color: '#34A853', shape: 'cylinder' },
        api: { color: '#8E44AD', shape: 'rect', isRounded: true },
        concept: { color: '#E67E22', shape: 'circle' },
        resource: { color: '#16A085', shape: 'document' },
        event: { color: '#3498DB', shape: 'circle' },
        decision: { color: '#F1C40F', shape: 'diamond' },
        person: { color: '#1ABC9C', shape: 'person' },
        default: { color: '#95A5A6', shape: 'rect' }
      },
      edgeTypes: {
        depends_on: { style: 'dashed', arrowhead: true, color: '#7F8C8D' },
        imports: { style: 'solid', arrowhead: true, color: '#2C3E50' },
        extends: { style: 'solid', arrowhead: true, color: '#E74C3C' },
        implements: { style: 'dotted', arrowhead: true, color: '#9B59B6' },
        contains: { style: 'solid', arrowhead: false, color: '#27AE60' },
        precedes: { style: 'solid', arrowhead: true, color: '#3498DB' },
        default: { style: 'solid', arrowhead: true, color: '#7F8C8D' }
      }
    };

    return {
      id: graph.id,
      name: graph.name,
      description: graph.description,
      type: graph.type,
      nodes,
      edges,
      layout: layoutSuggestion
    };
  }

  // 验证节点类型是否与图谱类型匹配
  private validateNodeTypeForGraphType(graphType: typeof GraphType[keyof typeof GraphType], nodeType: typeof NodeType[keyof typeof NodeType]): void {
    // 根据图谱类型，验证节点类型是否合法
    switch (graphType) {
      case GraphType.TOPOLOGY:
        // 拓扑结构图允许的节点类型
        const topologyAllowedTypes = [
          NodeType.COMPONENT,
          NodeType.MODULE,
          NodeType.SERVICE,
          NodeType.DATA,
          NodeType.API,
          NodeType.RESOURCE,
          NodeType.CONCEPT
        ];
        if (!topologyAllowedTypes.includes(nodeType as any)) {
          throw new KnowledgeGraphError(`节点类型 ${nodeType} 不适用于拓扑结构图`);
        }
        break;

      case GraphType.TIMELINE:
        // 时间线图谱允许的节点类型
        const timelineAllowedTypes = [
          NodeType.EVENT,
          NodeType.DECISION,
          NodeType.ITERATION,
          NodeType.PERSON
        ];
        if (!timelineAllowedTypes.includes(nodeType as any)) {
          throw new KnowledgeGraphError(`节点类型 ${nodeType} 不适用于时间线图谱`);
        }
        break;

      case GraphType.CHANGELOG:
        // 变更日志图谱允许的节点类型
        const changelogAllowedTypes = [
          NodeType.CHANGE,
          NodeType.FEATURE,
          NodeType.COMPONENT,
          NodeType.ITERATION,
          NodeType.PERSON
        ];
        if (!changelogAllowedTypes.includes(nodeType as any)) {
          throw new KnowledgeGraphError(`节点类型 ${nodeType} 不适用于变更日志图谱`);
        }
        break;

      case GraphType.REQUIREMENT:
        // 需求文档图谱允许的节点类型
        const requirementAllowedTypes = [
          NodeType.REQUIREMENT,
          NodeType.FEATURE,
          NodeType.COMPONENT,
          NodeType.ITERATION,
          NodeType.PERSON,
          NodeType.DECISION
        ];
        if (!requirementAllowedTypes.includes(nodeType as any)) {
          throw new KnowledgeGraphError(`节点类型 ${nodeType} 不适用于需求文档图谱`);
        }
        break;

      case GraphType.KNOWLEDGE_BASE:
        // 知识库图谱允许所有节点类型
        break;

      case GraphType.ONTOLOGY:
        // 本体论图谱允许的节点类型
        const ontologyAllowedTypes = [
          NodeType.CONCEPT,
          NodeType.RESOURCE,
          NodeType.DATA
        ];
        if (!ontologyAllowedTypes.includes(nodeType as any)) {
          throw new KnowledgeGraphError(`节点类型 ${nodeType} 不适用于本体论图谱`);
        }
        break;

      default:
        // 默认不进行类型限制
        break;
    }
  }

  // 验证边类型是否与图谱类型匹配
  private validateEdgeTypeForGraphType(graphType: typeof GraphType[keyof typeof GraphType], edgeType: typeof EdgeType[keyof typeof EdgeType]): void {
    // 根据图谱类型，验证边类型是否合法
    switch (graphType) {
      case GraphType.TOPOLOGY:
        // 拓扑结构图允许的边类型
        const topologyAllowedTypes = [
          EdgeType.DEPENDS_ON,
          EdgeType.IMPORTS,
          EdgeType.EXTENDS,
          EdgeType.IMPLEMENTS,
          EdgeType.CALLS,
          EdgeType.REFERENCES,
          EdgeType.CONTAINS,
          EdgeType.ASSOCIATED_WITH
        ];
        if (!topologyAllowedTypes.includes(edgeType as any)) {
          throw new KnowledgeGraphError(`边类型 ${edgeType} 不适用于拓扑结构图`);
        }
        break;

      case GraphType.TIMELINE:
        // 时间线图谱允许的边类型
        const timelineAllowedTypes = [
          EdgeType.PRECEDES,
          EdgeType.LEADS_TO,
          EdgeType.CREATED_BY,
          EdgeType.MODIFIED_BY
        ];
        if (!timelineAllowedTypes.includes(edgeType as any)) {
          throw new KnowledgeGraphError(`边类型 ${edgeType} 不适用于时间线图谱`);
        }
        break;

      case GraphType.CHANGELOG:
        // 变更日志图谱允许的边类型
        const changelogAllowedTypes = [
          EdgeType.PRECEDES,
          EdgeType.TRANSFORMS_TO,
          EdgeType.CREATED_BY,
          EdgeType.MODIFIED_BY,
          EdgeType.PART_OF
        ];
        if (!changelogAllowedTypes.includes(edgeType as any)) {
          throw new KnowledgeGraphError(`边类型 ${edgeType} 不适用于变更日志图谱`);
        }
        break;

      case GraphType.REQUIREMENT:
        // 需求文档图谱允许的边类型
        const requirementAllowedTypes = [
          EdgeType.IMPLEMENTS_REQ,
          EdgeType.DEPENDS_ON,
          EdgeType.PART_OF,
          EdgeType.CREATED_BY,
          EdgeType.MODIFIED_BY
        ];
        if (!requirementAllowedTypes.includes(edgeType as any)) {
          throw new KnowledgeGraphError(`边类型 ${edgeType} 不适用于需求文档图谱`);
        }
        break;

      case GraphType.KNOWLEDGE_BASE:
        // 知识库图谱允许所有边类型
        break;

      case GraphType.ONTOLOGY:
        // 本体论图谱允许的边类型
        const ontologyAllowedTypes = [
          EdgeType.EXTENDS,
          EdgeType.CONTAINS,
          EdgeType.PART_OF,
          EdgeType.ASSOCIATED_WITH
        ];
        if (!ontologyAllowedTypes.includes(edgeType as any)) {
          throw new KnowledgeGraphError(`边类型 ${edgeType} 不适用于本体论图谱`);
        }
        break;

      default:
        // 默认不进行类型限制
        break;
    }
  }

  // 获取特定类型的图谱列表
  async listGraphsByType(type?: typeof GraphType[keyof typeof GraphType], status?: string): Promise<SimpleGraph[]> {
    await this.ensureInitialized();
    let graphs = Array.from(this.graphs.values());

    if (type) {
      graphs = graphs.filter(g => g.type === type);
    }

    if (status) {
      graphs = graphs.filter(g => g.status === status);
    }

    // 为每个图谱添加简化的节点列表信息
    return graphs.map(graph => ({
      ...graph,
      nodes: graph.nodes?.map(node => ({
        id: node.id,
        name: node.name,
        type: node.type
      })) || []
    }));
  }

  // 从组件分析中导入数据
  async importFromComponentAnalysis(graphId: string, analysisData: any): Promise<Graph> {
    await this.ensureInitialized();
    const graph = await this.getGraph(graphId);

    if (graph.status === GraphStatus.ARCHIVED) {
      throw new KnowledgeGraphError('已归档的知识图谱不能导入数据');
    }

    // 实现导入逻辑...
    // 这里根据分析数据创建节点和边

    graph.updatedAt = new Date();
    this.graphs.set(graphId, graph);
    await this.persistChanges();
    return graph;
  }

  // 导出知识图谱为JSON格式
  async exportGraphToJson(graphId: string): Promise<string> {
    await this.ensureInitialized();
    const graph = await this.getGraph(graphId);
    return JSON.stringify(graph, null, 2);
  }

  // 持久化更改
  private async persistChanges(): Promise<void> {
    if (this.fileService && this.config.autoPersist !== false) {
      await this.fileService.updateGraphFile(this.graphs);
    }
  }

  // 更新资源信息
  async updateResource(graphId: string, resourceId: string, updateData: {
    name?: string;
    description?: string;
    title?: string;
  }): Promise<Resource> {
    await this.ensureInitialized();
    const graph = await this.getGraph(graphId);

    // 查找资源
    const resourceIndex = graph.resources.findIndex(r => r.id === resourceId);
    if (resourceIndex === -1) {
      throw new KnowledgeGraphError(`资源 ${resourceId} 不存在于图谱 ${graphId} 中`);
    }

    const resource = graph.resources[resourceIndex];

    // 更新资源信息
    if (updateData.name) {
      resource.name = updateData.name;
    }

    if (updateData.description) {
      resource.description = updateData.description;
    }

    if (updateData.title) {
      resource.title = updateData.title;
    }

    resource.updatedAt = new Date();
    graph.updatedAt = new Date();

    // 保存更改
    graph.resources[resourceIndex] = resource;
    await this.persistChanges();

    return resource;
  }

  // 删除资源
  async deleteResource(graphId: string, resourceId: string): Promise<void> {
    await this.ensureInitialized();
    const graph = await this.getGraph(graphId);

    // 查找资源
    const resourceIndex = graph.resources.findIndex(r => r.id === resourceId);
    if (resourceIndex === -1) {
      throw new KnowledgeGraphError(`资源 ${resourceId} 不存在于图谱 ${graphId} 中`);
    }

    const resource = graph.resources[resourceIndex];

    // 删除物理文件
    if (this.fileService) {
      try {
        // 从路径中提取文件名
        const fileName = resource.path.split('/').pop();
        if (fileName) {
          if (resource.type === 'svg') {
            await this.fileService.deleteSvg(fileName);
          } else if (resource.type === 'markdown' || resource.type === 'md') {
            await this.fileService.deleteMd(fileName);
          } else {
            console.warn(`未知的资源类型: ${resource.type}, 无法删除文件`);
          }
        }
      } catch (error) {
        console.error(`删除资源文件失败: ${error}`);
        // 继续删除资源记录
      }
    }

    // 从所有节点的资源引用中移除该资源ID
    for (const node of graph.nodes) {
      if (node.resources && node.resources.includes(resourceId)) {
        node.resources = node.resources.filter(id => id !== resourceId);
        node.updatedAt = new Date();
      }
    }

    // 从图谱的资源列表中移除
    graph.resources.splice(resourceIndex, 1);
    graph.updatedAt = new Date();

    // 保存更改
    await this.persistChanges();
  }
} 