import path from 'path';
import { KnowledgeGraphConfigSchema } from './types';

// 从环境变量加载配置
export function loadConfigFromEnv() {
  console.log("process.env", process.env);

  const graphDir = process.env.KNOWLEDGE_GRAPH_DIR || path.join(process.cwd(), 'knowledge_graph');
  const generateSvg = process.env.KNOWLEDGE_GRAPH_GENERATE_SVG !== 'false'; // 默认为true

  // 创建配置对象
  const config = {
    graphDir,
    autoCreate: true,
    autoPersist: true,
    generateSvg,
    svgSettings: {
      width: Number(process.env.KNOWLEDGE_GRAPH_SVG_WIDTH) || 1200,
      height: Number(process.env.KNOWLEDGE_GRAPH_SVG_HEIGHT) || 800,
      nodeRadius: Number(process.env.KNOWLEDGE_GRAPH_SVG_NODE_RADIUS) || 20,
      fontSize: Number(process.env.KNOWLEDGE_GRAPH_SVG_FONT_SIZE) || 12,
      fontFamily: process.env.KNOWLEDGE_GRAPH_SVG_FONT_FAMILY || 'Arial',
      colors: {
        component: process.env.KNOWLEDGE_GRAPH_SVG_COLOR_COMPONENT || '#4285F4',
        module: process.env.KNOWLEDGE_GRAPH_SVG_COLOR_MODULE || '#EA4335',
        service: process.env.KNOWLEDGE_GRAPH_SVG_COLOR_SERVICE || '#FBBC05',
        data: process.env.KNOWLEDGE_GRAPH_SVG_COLOR_DATA || '#34A853',
        api: process.env.KNOWLEDGE_GRAPH_SVG_COLOR_API || '#8E44AD',
        concept: process.env.KNOWLEDGE_GRAPH_SVG_COLOR_CONCEPT || '#E67E22',
        resource: process.env.KNOWLEDGE_GRAPH_SVG_COLOR_RESOURCE || '#16A085',
        default: process.env.KNOWLEDGE_GRAPH_SVG_COLOR_DEFAULT || '#95A5A6'
      }
    }
  };

  // 验证配置对象
  return KnowledgeGraphConfigSchema.parse(config);
} 