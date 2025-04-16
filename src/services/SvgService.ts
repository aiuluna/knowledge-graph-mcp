import { Graph, Node, Edge, NodeType } from '../models/Graph';
import { KnowledgeGraphConfig } from '../config/types';

export class SvgService {
  private settings: KnowledgeGraphConfig['svgSettings'];

  constructor(settings?: KnowledgeGraphConfig['svgSettings']) {
    this.settings = settings || {
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
    };
  }

  public generateGraphSvg(graph: Graph): string {
    const { width, height, nodeRadius, fontSize, fontFamily, colors } = this.settings;
    const nodes = graph.nodes;
    const edges = graph.edges;

    // 计算节点位置
    const positions = this.calculateNodePositions(nodes, edges, width, height);

    // 生成SVG
    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" />
      </marker>
    </defs>
    <style>
      .node { cursor: pointer; }
      .node:hover { opacity: 0.8; }
      .node-text { font-family: ${fontFamily}; font-size: ${fontSize}px; fill: #fff; text-anchor: middle; }
      .edge { stroke-width: 2; stroke: #999; marker-end: url(#arrowhead); }
      .edge:hover { stroke-width: 3; stroke: #666; }
      .edge-label { font-family: ${fontFamily}; font-size: ${fontSize - 2}px; fill: #666; text-anchor: middle; }
    </style>
    <rect width="100%" height="100%" fill="#f9f9f9" />
    <g class="graph">`;

    // 绘制边
    edges.forEach(edge => {
      const sourcePos = positions[edge.source];
      const targetPos = positions[edge.target];

      if (sourcePos && targetPos) {
        // 计算连接点
        const angle = Math.atan2(targetPos.y - sourcePos.y, targetPos.x - sourcePos.x);
        const sourceX = sourcePos.x + Math.cos(angle) * nodeRadius;
        const sourceY = sourcePos.y + Math.sin(angle) * nodeRadius;
        const targetX = targetPos.x - Math.cos(angle) * (nodeRadius + 5); // 5px为箭头偏移
        const targetY = targetPos.y - Math.sin(angle) * (nodeRadius + 5);

        svgContent += `
      <line class="edge" x1="${sourceX}" y1="${sourceY}" x2="${targetX}" y2="${targetY}" data-type="${edge.type}" data-id="${edge.id}" />`;

        // 如果边有标签，添加标签
        if (edge.label) {
          const midX = (sourceX + targetX) / 2;
          const midY = (sourceY + targetY) / 2;
          const labelOffsetX = Math.sin(angle) * 15; // 标签偏移量
          const labelOffsetY = -Math.cos(angle) * 15;

          svgContent += `
      <text class="edge-label" x="${midX + labelOffsetX}" y="${midY + labelOffsetY}">${edge.label}</text>`;
        }
      }
    });

    // 绘制节点
    nodes.forEach(node => {
      const pos = positions[node.id];
      if (pos) {
        const nodeColor = this.getNodeColor(node.type, colors);

        svgContent += `
      <g class="node" data-id="${node.id}" data-type="${node.type}">
        <circle cx="${pos.x}" cy="${pos.y}" r="${nodeRadius}" fill="${nodeColor}" />
        <text class="node-text" x="${pos.x}" y="${pos.y + 5}">${this.truncateText(node.name, 15)}</text>
      </g>`;
      }
    });

    // 添加图例
    svgContent += this.generateLegend(width, height);

    // 关闭SVG
    svgContent += `
    </g>
</svg>`;

    return svgContent;
  }

  private calculateNodePositions(nodes: Node[], edges: Edge[], width: number, height: number): Record<string, { x: number, y: number }> {
    const positions: Record<string, { x: number, y: number }> = {};
    const nodeCount = nodes.length;

    if (nodeCount === 0) {
      return positions;
    }

    // 简单的力导向布局算法
    // 初始化：均匀分布在一个圆上
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.4;

    nodes.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / nodeCount;
      positions[node.id] = {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle)
      };
    });

    // 应用力导向布局
    const iterations = 50;
    for (let i = 0; i < iterations; i++) {
      // 计算节点间的斥力
      const repulsionForce = 10000 / nodeCount;
      const forces: Record<string, { fx: number, fy: number }> = {};

      nodes.forEach(node => {
        forces[node.id] = { fx: 0, fy: 0 };
      });

      // 节点间斥力
      for (let j = 0; j < nodeCount; j++) {
        for (let k = j + 1; k < nodeCount; k++) {
          const node1 = nodes[j];
          const node2 = nodes[k];
          const pos1 = positions[node1.id];
          const pos2 = positions[node2.id];

          const dx = pos2.x - pos1.x;
          const dy = pos2.y - pos1.y;
          const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
          const force = repulsionForce / (distance * distance);

          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;

          forces[node1.id].fx -= fx;
          forces[node1.id].fy -= fy;
          forces[node2.id].fx += fx;
          forces[node2.id].fy += fy;
        }
      }

      // 边的吸引力
      edges.forEach(edge => {
        const sourcePos = positions[edge.source];
        const targetPos = positions[edge.target];

        if (sourcePos && targetPos) {
          const dx = targetPos.x - sourcePos.x;
          const dy = targetPos.y - sourcePos.y;
          const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
          const force = distance / 30;

          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;

          forces[edge.source].fx += fx;
          forces[edge.source].fy += fy;
          forces[edge.target].fx -= fx;
          forces[edge.target].fy -= fy;
        }
      });

      // 向中心的吸引力
      nodes.forEach(node => {
        const pos = positions[node.id];
        const dx = centerX - pos.x;
        const dy = centerY - pos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > radius) {
          const force = (distance - radius) / 10;
          forces[node.id].fx += (dx / distance) * force;
          forces[node.id].fy += (dy / distance) * force;
        }
      });

      // 应用力
      const damping = 0.9;
      nodes.forEach(node => {
        const force = forces[node.id];
        const pos = positions[node.id];

        pos.x += force.fx * damping;
        pos.y += force.fy * damping;

        // 边界约束
        pos.x = Math.max(this.settings.nodeRadius, Math.min(width - this.settings.nodeRadius, pos.x));
        pos.y = Math.max(this.settings.nodeRadius, Math.min(height - this.settings.nodeRadius, pos.y));
      });
    }

    return positions;
  }

  private generateLegend(width: number, height: number): string {
    const { colors, fontSize, fontFamily } = this.settings;
    const legendX = width - 150;
    const legendY = 30;
    const rectSize = 10;
    const textOffset = 15;

    let legend = `
    <g class="legend" transform="translate(${legendX}, ${legendY})">
      <rect width="140" height="${Object.keys(NodeType).length * 20 + 10}" fill="white" fill-opacity="0.8" rx="5" ry="5" />
      <text x="70" y="15" text-anchor="middle" font-family="${fontFamily}" font-size="${fontSize + 2}px" font-weight="bold">节点类型</text>`;

    Object.entries(NodeType).forEach(([key, value], index) => {
      const y = index * 20 + 30;
      const color = this.getNodeColor(value, colors);

      legend += `
      <rect x="10" y="${y}" width="${rectSize}" height="${rectSize}" fill="${color}" />
      <text x="${textOffset + 10}" y="${y + rectSize - 1}" font-family="${fontFamily}" font-size="${fontSize}px">${key}</text>`;
    });

    legend += `
    </g>`;

    return legend;
  }

  private getNodeColor(nodeType: string, colors: any): string {
    return colors[nodeType.toLowerCase()] || colors.default || '#95A5A6';
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - 3) + '...';
  }
} 