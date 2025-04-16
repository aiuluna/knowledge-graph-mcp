---
description: 当用户需要生成svg格式的图形时调用的规范
globs: 
alwaysApply: false
---
# 手绘风格 SVG 图形创建通用指南

## 概述

本指南提供了创建手绘风格 SVG 图形的通用方法和技巧，适用于各种场景，包括但不限于流程图、概念图、关系图、组织结构图等。手绘风格能为技术图表增添亲和力，使内容更具吸引力和可记忆性。

## 核心设计原则

1. **视觉清晰性**：即使采用手绘风格，信息传达的清晰度仍是首要考虑因素
2. **一致的风格**：整个图表应保持统一的手绘风格和视觉语言
3. **合适的视觉层次**：通过大小、颜色、分组等建立清晰的视觉层次
4. **适当的空间利用**：确保元素之间有足够的空间，避免过度拥挤
5. **读者友好的布局**：遵循自然的阅读流向（从左到右，从上到下）

## SVG 基础结构

```xml
<svg width="宽度" height="高度" xmlns="http://www.w3.org/2000/svg">
  <!-- 滤镜定义 -->
  <!-- 背景 -->
  <!-- 图形元素 -->
  <!-- 文本元素 -->
  <!-- 连接线与箭头 -->
  <!-- 图例与说明 -->
</svg>
```

## 中文环境配置

### 1. 基本设置

- **字体选择**：PingFangSC、Microsoft YaHei、SimHei（优先使用系统中文字体）
- **文本大小**：标题20-24px，主流程12-14px，详情说明14-16px
- **矩形尺寸**：主流程120×50px，详情280×50px（根据文本长度可适当调整）
- **SVG合理宽度**：600-800px（避免页面折回和渲染问题）
- **字体设置示例**：`font-family="PingFangSC, Microsoft YaHei, SimHei"`

### 2. 中文文本处理

- 中文文本应使用适当字间距，避免过于拥挤
- 避免应用过强的手绘效果到中文文本上，保证可读性
- 对于长文本，可使用较小字号并增加容器宽度，避免换行导致难以阅读

## 手绘效果实现

### 1. 创建手绘风格滤镜

```xml
<!-- 纸质纹理背景滤镜 -->
<filter id="paper-texture" x="0" y="0" width="100%" height="100%">
  <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="5" result="noise"/>
  <feDiffuseLighting in="noise" lighting-color="#ffffff" surfaceScale="1" result="diffLight">
    <feDistantLight azimuth="45" elevation="60"/>
  </feDiffuseLighting>
  <feComposite in="SourceGraphic" in2="diffLight" operator="arithmetic" k1="1" k2="0" k3="0" k4="0"/>
</filter>

<!-- 元素手绘效果滤镜 -->
<filter id="hand-drawn" x="-10%" y="-10%" width="120%" height="120%">
  <feTurbulence type="turbulence" baseFrequency="0.04" numOctaves="2" result="turbulence"/>
  <feDisplacementMap in="SourceGraphic" in2="turbulence" scale="1.5" xChannelSelector="R" yChannelSelector="G"/>
</filter>

<!-- 更轻微的手绘效果滤镜（适用于文字） -->
<filter id="slight-hand-drawn" x="-5%" y="-5%" width="110%" height="110%">
  <feTurbulence type="turbulence" baseFrequency="0.03" numOctaves="2" result="turbulence"/>
  <feDisplacementMap in="SourceGraphic" in2="turbulence" scale="0.8" xChannelSelector="R" yChannelSelector="G"/>
</filter>
```

### 2. 背景设置

```xml
<!-- 手绘风格的背景 -->
<rect width="100%" height="100%" fill="#fcfcfc" filter="url(#paper-texture)"/>
```

## 通用元素模板

### 1. 矩形容器（适用于节点、框、卡片等）

```xml
<g transform="translate(X, Y)" filter="url(#hand-drawn)">
  <rect width="宽度" height="高度" rx="10" ry="10" fill="颜色" stroke="#333" stroke-width="2" style="fill-opacity: 0.6"/>
  <!-- 可选：标题分隔线 -->
  <line x1="0" y1="30" x2="宽度" y2="30" stroke="#333" stroke-width="2"/>
  <text x="宽度/2" y="20" font-family="PingFangSC, Microsoft YaHei, SimHei" font-size="16" text-anchor="middle" fill="#333">标题文本</text>
  <!-- 内容文本 -->
  <text x="10" y="50" font-family="PingFangSC, Microsoft YaHei, SimHei" font-size="12" fill="#333">内容文本1</text>
  <text x="10" y="70" font-family="PingFangSC, Microsoft YaHei, SimHei" font-size="12" fill="#333">内容文本2</text>
</g>
```

### 2. 圆形/椭圆容器

```xml
<g transform="translate(X, Y)" filter="url(#hand-drawn)">
  <ellipse cx="半径x" cy="半径y" rx="半径x" ry="半径y" fill="颜色" stroke="#333" stroke-width="2" style="fill-opacity: 0.6"/>
  <text x="半径x" y="半径y" font-family="PingFangSC, Microsoft YaHei, SimHei" font-size="14" text-anchor="middle" dominant-baseline="middle" fill="#333">文本内容</text>
</g>
```

### 3. 菱形容器（适用于决策点）

```xml
<g transform="translate(X, Y)" filter="url(#hand-drawn)">
  <polygon points="0,50 100,0 200,50 100,100" fill="颜色" stroke="#333" stroke-width="2" style="fill-opacity: 0.6"/>
  <text x="100" y="50" font-family="PingFangSC, Microsoft YaHei, SimHei" font-size="14" text-anchor="middle" dominant-baseline="middle" fill="#333">决策内容</text>
</g>
```

### 4. 连接线和箭头

```xml
<!-- 直线连接 -->
<path d="M起点x,起点y L终点x,终点y" stroke="#333" stroke-width="2" fill="none" filter="url(#hand-drawn)"/>

<!-- 曲线连接 (贝塞尔曲线) -->
<path d="M起点x,起点y C控制点1x,控制点1y 控制点2x,控制点2y 终点x,终点y"
      stroke="#333" stroke-width="2" fill="none" filter="url(#hand-drawn)"/>

<!-- 折线连接 -->
<path d="M起点x,起点y L中点x,起点y L中点x,终点y L终点x,终点y"
      stroke="#333" stroke-width="2" fill="none" filter="url(#hand-drawn)"/>

<!-- 箭头 -->
<polygon points="终点x-10,终点y-5 终点x,终点y 终点x-10,终点y+5"
         fill="#333" stroke="#333" stroke-width="1" filter="url(#hand-drawn)"/>

<!-- 带标签的连接线 -->
<text x="标签x" y="标签y" font-family="PingFangSC, Microsoft YaHei, SimHei" font-size="12" fill="#333" filter="url(#slight-hand-drawn)">连接标签</text>
```

## 流程图专用模板

### 1. 中文业务流程图模板（水平式）

```xml
<!-- 中文流程图模板（水平主流程） -->
<svg width="800" height="800" xmlns="http://www.w3.org/2000/svg">
  <!-- 标题 -->
  <text x="400" y="50" font-family="PingFangSC, Microsoft YaHei, SimHei" font-size="24" text-anchor="middle" fill="#333" filter="url(#hand-drawn)">流程图标题</text>

  <!-- 顶部主流程部分 -->
  <g transform="translate(20, 80)" filter="url(#hand-drawn)">
    <!-- 步骤1 -->
    <rect x="0" y="0" width="120" height="50" rx="10" ry="10" fill="#a8d8ea" stroke="#333" stroke-width="2"/>
    <text x="60" y="30" font-family="PingFangSC, Microsoft YaHei, SimHei" font-size="12" text-anchor="middle" fill="#333">步骤一</text>
    
    <!-- 箭头连接 -->
    <line x1="120" y1="25" x2="150" y2="25" stroke="#333" stroke-width="2"/>
    <polygon points="140,20 150,25 140,30" fill="#333"/>
    
    <!-- 步骤2 -->
    <rect x="150" y="0" width="120" height="50" rx="10" ry="10" fill="#a8e6cf" stroke="#333" stroke-width="2"/>
    <text x="210" y="30" font-family="PingFangSC, Microsoft YaHei, SimHei" font-size="12" text-anchor="middle" fill="#333">步骤二</text>
  </g>
  
  <!-- 下部详细逻辑部分，左右两栏 -->
  <g transform="translate(50, 200)">
    <rect x="0" y="0" width="320" height="380" rx="10" ry="10" fill="#ffd3b6" stroke="#333" stroke-width="2" fill-opacity="0.3"/>
    <text x="160" y="30" font-family="PingFangSC, Microsoft YaHei, SimHei" font-size="16" text-anchor="middle" fill="#333">左侧详情区</text>
    
    <!-- 子步骤示例 -->
    <rect x="20" y="60" width="280" height="50" rx="10" ry="10" fill="#ffd3b6" stroke="#333" stroke-width="2"/>
    <text x="160" y="90" font-family="PingFangSC, Microsoft YaHei, SimHei" font-size="14" text-anchor="middle" fill="#333">子步骤1</text>
  </g>
  
  <g transform="translate(430, 200)">
    <rect x="0" y="0" width="320" height="380" rx="10" ry="10" fill="#d3bcfa" stroke="#333" stroke-width="2" fill-opacity="0.3"/>
    <text x="160" y="30" font-family="PingFangSC, Microsoft YaHei, SimHei" font-size="16" text-anchor="middle" fill="#333">右侧详情区</text>
    
    <!-- 子步骤示例 -->
    <rect x="20" y="60" width="280" height="50" rx="10" ry="10" fill="#d3bcfa" stroke="#333" stroke-width="2"/>
    <text x="160" y="90" font-family="PingFangSC, Microsoft YaHei, SimHei" font-size="14" text-anchor="middle" fill="#333">子步骤1</text>
  </g>
</svg>
```

### 2. 条件分支处理模板

```xml
<!-- 条件分支流程示例 -->
<g transform="translate(X, Y)" filter="url(#hand-drawn)">
  <!-- 决策点 -->
  <polygon points="350,0 300,25 350,50 400,25" fill="#ffdca9" stroke="#333" stroke-width="2"/>
  <text x="350" y="30" font-family="PingFangSC, Microsoft YaHei, SimHei" font-size="12" text-anchor="middle" fill="#333">条件判断</text>
  
  <!-- 条件分支1 -->
  <line x1="350" y1="50" x2="350" y2="80" stroke="#333" stroke-width="2"/>
  <text x="340" y="70" font-family="PingFangSC, Microsoft YaHei, SimHei" font-size="10" text-anchor="end" fill="#333">条件1</text>
  <rect x="290" y="80" width="120" height="50" rx="10" ry="10" fill="#ffaaa5" stroke="#333" stroke-width="2"/>
  <text x="350" y="110" font-family="PingFangSC, Microsoft YaHei, SimHei" font-size="12" text-anchor="middle" fill="#333">分支1结果</text>
  
  <!-- 条件分支2 -->
  <line x1="400" y1="25" x2="430" y2="25" stroke="#333" stroke-width="2"/>
  <text x="415" y="15" font-family="PingFangSC, Microsoft YaHei, SimHei" font-size="10" text-anchor="middle" fill="#333">条件2</text>
  <rect x="430" y="0" width="120" height="50" rx="10" ry="10" fill="#a8e6cf" stroke="#333" stroke-width="2"/>
  <text x="490" y="30" font-family="PingFangSC, Microsoft YaHei, SimHei" font-size="12" text-anchor="middle" fill="#333">分支2结果</text>
</g>
```

### 3. 完整流程图布局最佳实践

1. **顶部主流程区**：
   - 放置主要流程步骤，从左到右或从上到下排列
   - 使用清晰的箭头指示方向
   - 决策点使用菱形，普通步骤使用圆角矩形

2. **下部详情区**：
   - 左右分栏展示不同流程的详细步骤
   - 每个详情区使用浅色背景框包围
   - 详情步骤垂直排列，保持30-40px间距

3. **连接线原则**：
   - 避免交叉连线
   - 主流程使用水平连线，子流程使用垂直连线
   - 为所有连线添加箭头指示方向
   - 条件分支处添加文字标签

## 空间布局平衡原则

1. **元素间距规则**：
   - 同级元素间保持30-50px的间距
   - 不同级别元素组之间保持60-100px的间距
   - 不相关流程应明确分区，避免误解
   - 决策分支应有足够空间展开，避免拥挤

2. **避免过度复杂**：
   - 单个SVG中步骤不宜超过10-12个
   - 页面内容过多时，考虑分解为多个SVG而非单一大图
   - 复杂逻辑可使用分层结构展示

3. **颜色区分原则**：
   - 使用不同色系区分不同流程或区域
   - 相关步骤使用同色系的不同深浅
   - 决策点和重要节点可使用突出色调
   - 保持整体色调和谐统一

## 颜色使用指南

### 1. 配色方案建议

手绘风格应使用柔和的色调，避免过于鲜艳的颜色：

- **主要元素**：使用较浅的基础色，如：

  - 蓝色系：#a8d8ea, #bedcfa
  - 绿色系：#a8e6cf, #dcedc1
  - 红色系：#ffaaa5, #ffd3b6
  - 紫色系：#d3bcfa, #e2bcdb
  - 黄色系：#fdffb6, #ffdca9

- **次要元素**：使用更浅的颜色或白色
- **文本**：深灰色 (#333) 或深蓝色 (#2c3e50)，而非纯黑色
- **边框**：深灰色，通常与文本颜色一致
- **连接线**：与边框颜色相同或稍深

### 2. 不透明度设置

- 填充颜色：0.5-0.7 的不透明度，使图表更柔和
- 文本和线条：保持完全不透明，确保可读性

## 适配不同图表类型

### 1. 流程图

- 使用特定形状表示不同类型的节点（矩形、菱形、圆形）
- 用箭头清晰指示流程方向
- 保持从上到下或从左到右的流向

### 2. 概念图/思维导图

- 中心概念使用较大的形状
- 相关概念按层次向外扩展
- 使用颜色区分不同的分支或类别

### 3. 网络/关系图

- 用节点表示实体
- 用不同线型表示不同类型的关系
- 考虑使用文本标签说明关系类型

### 4. 组织结构图

- 顶层节点位于顶部
- 使用垂直或水平层次布局
- 同级元素保持对齐

## 常见陷阱与解决方案

1. **过度失真**：手绘效果参数过大导致文字难以阅读
   - 解决：为文字使用较小的 displacement 参数或单独的滤镜

2. **元素重叠**：元素之间缺乏足够的空间
   - 解决：增加画布大小或减小元素尺寸，预留至少 20-30px 的间距

3. **风格不一致**：混合使用手绘和非手绘元素
   - 解决：确保所有元素应用相同的滤镜和设计语言

4. **文本溢出**：文本超出容器边界
   - 解决：动态调整容器大小或减少文本长度

5. **过度复杂**：在一个图表中包含过多信息
   - 解决：分解为多个简单图表或使用分层显示

6. **SVG宽度过大**：设置过宽导致显示问题
   - 解决：将宽度控制在800px以内，合理安排元素布局

7. **中文显示问题**：字体不支持中文或间距不合理
   - 解决：使用中文字体(PingFangSC等)，适当增加容器宽度

## 总结

创建手绘风格的 SVG 图表是艺术与技术的结合。通过本指南的滤镜技术、元素模板和设计原则，可以创建既专业又亲切的可视化图表，适用于各种场景，包括教学、演示、文档和网站。记住，好的手绘风格既能保持信息的清晰传达，又能增添视觉吸引力和个性化表达。特别是在中文环境下，需要更加注重字体选择和空间布局，确保流程图的专业性和可读性。