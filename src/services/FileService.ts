import * as fs from 'fs/promises';
import * as path from 'path';
import { Graph, GraphStatus } from '../models/Graph';
import { KnowledgeGraphError } from './KnowledgeGraphService';
import * as fsSync from 'node:fs';
import { formatLocalDateTime } from '../utils/datetime';
import crypto from 'crypto';
import { existsSync } from 'node:fs';

export class FileService {
  private graphDir: string;
  private jsonFile: string;

  constructor(graphDir: string) {
    this.graphDir = graphDir;
    this.jsonFile = path.join(graphDir, 'graph.json');
    this.ensureDirectories();
  }

  private ensureDirectories() {
    try {
      // 首先确保根目录和resources目录存在
      const resourcesDir = path.join(this.graphDir, 'resources');
      if (!fsSync.existsSync(this.graphDir)) {
        fsSync.mkdirSync(this.graphDir, { recursive: true });
      }
      if (!fsSync.existsSync(resourcesDir)) {
        fsSync.mkdirSync(resourcesDir, { recursive: true });
      }

      // 确保resources下的子目录存在
      for (const dir of ['svg', 'md']) {
        const dirPath = path.join(resourcesDir, dir);
        if (!fsSync.existsSync(dirPath)) {
          fsSync.mkdirSync(dirPath, { recursive: true });
        }
      }

      // 确保data_structures目录存在
      const dataStructuresDir = path.join(this.graphDir, 'data_structures');
      if (!fsSync.existsSync(dataStructuresDir)) {
        fsSync.mkdirSync(dataStructuresDir, { recursive: true });
      }
    } catch (error) {
      console.error('确保目录存在失败:', error);
      throw new KnowledgeGraphError(`无法创建必要的目录: ${error}`);
    }
  }

  // 获取图谱目录路径
  getGraphDir(): string {
    return this.graphDir;
  }

  async init(): Promise<void> {
    console.log(`FileService 初始化中，图谱目录: ${this.graphDir}`);

    try {
      // 确保主目录存在
      if (!existsSync(this.graphDir)) {
        console.log(`创建图谱主目录: ${this.graphDir}`);
        await fs.mkdir(this.graphDir, { recursive: true });
      }

      // 确保resources目录结构存在
      const resourcesPath = path.join(this.graphDir, 'resources');
      if (!existsSync(resourcesPath)) {
        console.log(`创建resources目录: ${resourcesPath}`);
        await fs.mkdir(resourcesPath, { recursive: true });
      }

      // 确保svg目录存在
      const svgPath = path.join(resourcesPath, 'svg');
      if (!existsSync(svgPath)) {
        console.log(`创建svg目录: ${svgPath}`);
        await fs.mkdir(svgPath, { recursive: true });
      }

      // 确保md目录存在
      const mdPath = path.join(resourcesPath, 'md');
      if (!existsSync(mdPath)) {
        console.log(`创建md目录: ${mdPath}`);
        await fs.mkdir(mdPath, { recursive: true });
      }

      // 确保custom_svg目录存在
      const customSvgPath = path.join(resourcesPath, 'custom_svg');
      if (!existsSync(customSvgPath)) {
        console.log(`创建custom_svg目录: ${customSvgPath}`);
        await fs.mkdir(customSvgPath, { recursive: true });
      }

      // 检查JSON文件是否存在
      if (!existsSync(this.jsonFile)) {
        console.log(`创建图谱JSON文件: ${this.jsonFile}`);
        await fs.writeFile(this.jsonFile, '[]', 'utf-8');
      }

      console.log('FileService 初始化完成');
    } catch (error: any) {
      console.error('FileService 初始化失败:', error);
      throw new KnowledgeGraphError(`FileService 初始化失败: ${error.message}`);
    }
  }

  async readGraphFile(): Promise<{ graphs: Graph[] }> {
    try {
      const content = await fs.readFile(this.jsonFile, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Error reading graph file:', error);
      return { graphs: [] };
    }
  }

  async updateGraphFile(graphs: Map<string, Graph>): Promise<void> {
    try {
      const graphsArray = Array.from(graphs.values());
      const data = {
        graphs: graphsArray,
        lastUpdated: new Date()
      };
      await this.writeJsonFile(data);

      // 更新每个图谱的Markdown文档
      for (const graph of graphsArray) {
        if (graph.status === GraphStatus.PUBLISHED) {
          await this.updateMarkdownDoc(graph);
        }
      }
    } catch (error) {
      console.error('Error updating graph file:', error);
      throw error;
    }
  }

  private async writeJsonFile(data: any): Promise<void> {
    // 自定义JSON序列化，保留Date对象
    const json = JSON.stringify(data, null, 2);
    await fs.writeFile(this.jsonFile, json, 'utf-8');
  }

  private async updateMarkdownDoc(graph: Graph): Promise<void> {
    const mdContent = this.generateMarkdownContent(graph);
    const mdPath = path.join(this.graphDir, 'resources', 'md', `${graph.id}.md`);
    await fs.writeFile(mdPath, mdContent, 'utf-8');
  }

  private generateMarkdownContent(graph: Graph): string {
    let content = `# ${graph.name}\n\n`;

    if (graph.description) {
      content += `${graph.description}\n\n`;
    }

    content += `## 基本信息\n\n`;
    content += `- **ID:** \`${graph.id}\`\n`;
    content += `- **状态:** ${graph.status}\n`;
    content += `- **创建时间:** ${formatLocalDateTime(graph.createdAt)}\n`;
    content += `- **更新时间:** ${formatLocalDateTime(graph.updatedAt)}\n`;
    if (graph.publishedAt) {
      content += `- **发布时间:** ${formatLocalDateTime(graph.publishedAt)}\n`;
    }

    content += `\n## 节点 (${graph.nodes.length})\n\n`;
    for (const node of graph.nodes) {
      content += `### ${node.name} (\`${node.id}\`)\n\n`;
      content += `- **类型:** ${node.type}\n`;
      if (node.description) {
        content += `- **描述:** ${node.description}\n`;
      }
      if (node.filePath) {
        content += `- **文件路径:** \`${node.filePath}\`\n`;
      }
      content += `- **创建时间:** ${formatLocalDateTime(node.createdAt)}\n`;

      if (node.resources && node.resources.length > 0) {
        content += `- **资源:**\n`;
        for (const resourceId of node.resources) {
          const resource = graph.resources.find(r => r.id === resourceId);
          if (resource) {
            content += `  - [${resource.name}](${resource.path})\n`;
          }
        }
      }

      // 查找与该节点相关的边
      const relatedEdges = graph.edges.filter(e => e.source === node.id || e.target === node.id);
      if (relatedEdges.length > 0) {
        content += `- **关系:**\n`;
        for (const edge of relatedEdges) {
          const isSource = edge.source === node.id;
          const otherNodeId = isSource ? edge.target : edge.source;
          const otherNode = graph.nodes.find(n => n.id === otherNodeId);
          if (otherNode) {
            const relation = isSource ? `→ ${edge.type} →` : `← ${edge.type} ←`;
            content += `  - ${otherNode.name} ${relation}\n`;
          }
        }
      }

      content += `\n`;
    }

    if (graph.resources.length > 0) {
      content += `## 资源\n\n`;
      for (const resource of graph.resources) {
        content += `- [${resource.name}](${resource.path}) (${resource.type})\n`;
        if (resource.description) {
          content += `  ${resource.description}\n`;
        }
      }
    }

    return content;
  }

  // 保存资源文件
  async saveResource(resourceId: string, type: string, content: Buffer | string): Promise<string> {
    const resourcesDir = path.join(this.graphDir, 'resources');
    const resourcePath = path.join(resourcesDir, `${resourceId}.${type}`);

    if (typeof content === 'string') {
      await fs.writeFile(resourcePath, content, 'utf-8');
    } else {
      await fs.writeFile(resourcePath, content);
    }

    return resourcePath;
  }

  // 保存SVG图表，使用传入的文件名
  async saveSvg(graphId: string, fileName: string, svgContent: string): Promise<string> {
    try {
      // 确保文件扩展名正确
      const normalizedFileName = fileName.endsWith('.svg') ? fileName : `${fileName}.svg`;
      const filePath = path.join(this.graphDir, 'resources', 'svg', normalizedFileName);

      // 检查文件是否已存在，避免重复写入
      if (!existsSync(filePath)) {
        await fs.writeFile(filePath, svgContent, 'utf-8');
        console.log(`已保存新的SVG文件: ${normalizedFileName}`);
      } else {
        console.log(`SVG文件已存在，使用现有文件: ${normalizedFileName}`);
      }

      return normalizedFileName; // 返回文件名而不是完整路径
    } catch (error) {
      console.error('保存SVG图表失败:', error);
      throw new KnowledgeGraphError(`无法保存SVG图表: ${error}`);
    }
  }

  // 读取资源文件
  async readResource(resourcePath: string): Promise<Buffer> {
    return fs.readFile(path.join(this.graphDir, resourcePath));
  }

  // 加载图谱数据
  async loadGraphs(): Promise<any> {
    try {
      const filePath = path.join(this.graphDir, 'graph.json');

      if (!fsSync.existsSync(filePath)) {
        // 如果文件不存在，返回空数据结构
        return { graphs: [], lastUpdated: formatLocalDateTime(new Date()) };
      }

      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('加载图谱数据失败:', error);
      throw new KnowledgeGraphError(`无法加载图谱数据: ${error}`);
    }
  }

  // 保存图谱数据
  async saveGraphs(graphs: any[]): Promise<void> {
    try {
      const filePath = path.join(this.graphDir, 'graph.json');
      const data = {
        graphs,
        lastUpdated: formatLocalDateTime(new Date())
      };
      await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error('保存图谱数据失败:', error);
      throw new KnowledgeGraphError(`无法保存图谱数据: ${error}`);
    }
  }

  // 保存Markdown文档，使用传入的文件名
  async saveMd(graphId: string, fileName: string, mdContent: string): Promise<string> {
    try {
      // 确保文件扩展名正确
      const normalizedFileName = fileName.endsWith('.md') ? fileName : `${fileName}.md`;
      const filePath = path.join(this.graphDir, 'resources', 'md', normalizedFileName);

      // 检查文件是否已存在，避免重复写入
      if (!existsSync(filePath)) {
        await fs.writeFile(filePath, mdContent, 'utf-8');
        console.log(`已保存新的Markdown文件: ${normalizedFileName}`);
      } else {
        console.log(`Markdown文件已存在，使用现有文件: ${normalizedFileName}`);
      }

      return normalizedFileName; // 返回文件名而不是完整路径
    } catch (error) {
      console.error('保存Markdown文档失败:', error);
      throw new KnowledgeGraphError(`无法保存Markdown文档: ${error}`);
    }
  }

  // 获取SVG图表
  async getSvg(svgName: string): Promise<string> {
    try {
      const filePath = path.join(this.graphDir, 'resources', 'svg', svgName);

      if (!fsSync.existsSync(filePath)) {
        throw new KnowledgeGraphError(`SVG图表不存在: ${svgName}`);
      }

      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      console.error('获取SVG图表失败:', error);
      throw new KnowledgeGraphError(`无法获取SVG图表: ${error}`);
    }
  }

  // 删除SVG文件
  async deleteSvg(svgName: string): Promise<void> {
    try {
      const filePath = path.join(this.graphDir, 'resources', 'svg', svgName);

      if (!fsSync.existsSync(filePath)) {
        console.warn(`SVG图表不存在: ${svgName}`);
        return;
      }

      await fs.unlink(filePath);
      console.log(`已删除SVG文件: ${svgName}`);
    } catch (error) {
      console.error('删除SVG文件失败:', error);
      throw new KnowledgeGraphError(`无法删除SVG文件: ${error}`);
    }
  }

  // 获取Markdown文档
  async getMd(fileName: string): Promise<string> {
    try {
      const filePath = path.join(this.graphDir, 'resources', 'md', fileName);

      if (!fsSync.existsSync(filePath)) {
        throw new KnowledgeGraphError(`Markdown文档不存在: ${fileName}`);
      }

      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      console.error('获取Markdown文档失败:', error);
      throw new KnowledgeGraphError(`无法获取Markdown文档: ${error}`);
    }
  }

  // 删除Markdown文件
  async deleteMd(fileName: string): Promise<void> {
    try {
      const filePath = path.join(this.graphDir, 'resources', 'md', fileName);

      if (!fsSync.existsSync(filePath)) {
        console.warn(`Markdown文档不存在: ${fileName}`);
        return;
      }

      await fs.unlink(filePath);
      console.log(`已删除Markdown文件: ${fileName}`);
    } catch (error) {
      console.error('删除Markdown文档失败:', error);
      throw new KnowledgeGraphError(`无法删除Markdown文档: ${error}`);
    }
  }
} 