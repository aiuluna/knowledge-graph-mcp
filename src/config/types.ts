import { z } from 'zod';

export const KnowledgeGraphConfigSchema = z.object({
  graphDir: z.string().optional(),  // 知识图谱存储目录，可选
  autoCreate: z.boolean().default(true),  // 是否自动创建文件夹，默认true
  autoPersist: z.boolean().default(true), // 是否自动持久化，默认true
  generateSvg: z.boolean().default(true), // 是否自动生成SVG图，默认true
  svgSettings: z.object({
    width: z.number().default(1200),
    height: z.number().default(800),
    nodeRadius: z.number().default(20),
    fontSize: z.number().default(12),
    fontFamily: z.string().default('Arial'),
    colors: z.object({
      component: z.string().default('#4285F4'),
      module: z.string().default('#EA4335'),
      service: z.string().default('#FBBC05'),
      data: z.string().default('#34A853'),
      api: z.string().default('#8E44AD'),
      concept: z.string().default('#E67E22'),
      resource: z.string().default('#16A085'),
      default: z.string().default('#95A5A6')
    }).default({})
  }).default({})
});

export type KnowledgeGraphConfig = z.infer<typeof KnowledgeGraphConfigSchema>; 