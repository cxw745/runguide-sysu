# 📖 中山大学飞跃手册

由中大学子自发维护的真实经验分享平台。

## 项目简介

这是一个基于 Astro + Vercel 构建的现代化经验分享平台，支持：

- 📝 **在线投稿** - 使用 GitHub OAuth 登录，在线编写 Markdown 文章
- 🔍 **全文搜索** - 支持文章标题、内容、标签搜索
- 🎓 **专业分类** - 按专业自动归类文章
- 🌓 **双主题** - 支持亮色/暗色主题切换
- 📱 **响应式设计** - 完美适配移动端和桌面端

## 技术栈

- **框架**: [Astro 6](https://astro.build/) - 零 JS 默认输出，极致性能
- **部署**: [Vercel](https://vercel.com/) - 边缘网络，全球加速
- **样式**: 原生 CSS 变量 - 无运行时开销
- **内容**: Content Collections - Markdown 即文章
- **认证**: GitHub OAuth - 安全可靠

## 项目结构

```
飞跃手册/
├── src/
│   ├── content/articles/       # Markdown 文章存放目录
│   ├── components/             # Astro 组件
│   │   ├── Header.astro        # 顶部导航
│   │   ├── Footer.astro        # 页脚
│   │   ├── SearchModal.astro   # 搜索弹窗
│   │   └── ...
│   ├── layouts/                # 布局组件
│   │   ├── BaseLayout.astro    # 基础布局
│   │   └── PageLayout.astro    # 页面布局（含搜索）
│   ├── pages/                  # 页面路由
│   │   ├── api/                # API 端点
│   │   │   ├── auth/           # OAuth 认证
│   │   │   ├── submit/         # 投稿接口
│   │   │   └── contributors/   # 贡献者接口
│   │   ├── index.astro         # 首页
│   │   ├── articles/           # 文章相关页面
│   │   ├── submit/index.astro  # 投稿页面
│   │   └── about.astro         # 关于页面
│   └── styles/
│       └── global.css          # 全局样式
├── public/                     # 静态资源
├── astro.config.mjs            # Astro 配置
├── content.config.ts           # 内容集合定义
└── package.json
```

## 快速开始

### 1. 安装依赖

```bash
npm install
# 或
pnpm install
```

### 2. 配置环境变量

创建 `.env` 文件：

```env
# GitHub OAuth 配置
OAUTH_CLIENT_ID=your_github_oauth_client_id
OAUTH_CLIENT_SECRET=your_github_oauth_client_secret

# GitHub Token（用于投稿功能）
GITHUB_TOKEN=your_github_personal_access_token
GITHUB_REPO=your_username/your_repo
```

**GitHub OAuth App 设置步骤：**

1. 访问 GitHub Settings → Developer settings → OAuth Apps
2. 点击 "New OAuth App"
3. 填写信息：
   - Application name: 中大飞跃手册
   - Homepage URL: `http://localhost:4321`（开发）或 `https://your-domain.vercel.app`（生产）
   - Authorization callback URL: `http://localhost:4321/api/auth/callback`（开发）或 `https://your-domain.vercel.app/api/auth/callback`（生产）
4. 保存后获取 Client ID 和 Client Secret

### 3. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:4321 查看效果。

### 4. 构建生产版本

```bash
npm run build
```

## 如何添加文章

### 方式一：在线投稿（推荐）

1. 访问 `/submit` 页面
2. 使用 GitHub 账号登录
3. 填写文章信息（标题、作者、分类、专业、摘要）
4. 使用 Markdown 编写正文
5. 提交审核，自动创建 Pull Request

### 方式二：直接添加 Markdown 文件

在 `src/content/articles/` 目录下新建 `.md` 文件：

```markdown
---
title: "你的文章标题"
author: "作者名"
date: "2025-04-14"
category: "考研"                # 转专业 / 保研 / 考研 / 出国留学 / 就业 / 其他
major: "计算机科学与技术"       # 专业名称
tags: ["标签1", "标签2"]         # 可选
excerpt: "文章摘要，用于列表展示"
---

正文内容...支持完整的 Markdown 语法
```

**注意事项：**
- `category` 必须是枚举值之一
- `major` 用于按专业分类展示
- `excerpt` 建议控制在 50 字以内

## 部署到 Vercel

### 自动部署（推荐）

1. 将代码推送到 GitHub 仓库
2. 在 [Vercel](https://vercel.com/) 导入项目
3. 配置环境变量（见上文）
4. 自动部署完成

### 环境变量配置

在 Vercel Dashboard → Project Settings → Environment Variables 中添加：

| 变量名 | 说明 | 必需 |
|--------|------|------|
| `OAUTH_CLIENT_ID` | GitHub OAuth App 的 Client ID | ✅ |
| `OAUTH_CLIENT_SECRET` | GitHub OAuth App 的 Client Secret | ✅ |
| `GITHUB_TOKEN` | GitHub Personal Access Token | ✅ |
| `GITHUB_REPO` | 仓库名，如 `username/repo` | ✅ |

### GitHub OAuth App 生产环境配置

部署后，需要更新 GitHub OAuth App 的回调地址：

- Homepage URL: `https://your-domain.vercel.app`
- Authorization callback URL: `https://your-domain.vercel.app/api/auth/callback`

## 设计系统

### 双主题

| 属性 | 亮色 | 暗色 |
|------|------|------|
| 背景 | 米白 `#FAFAF5` | 深蓝紫 `#0F0E1A` |
| 强调色 | 黄色 `#E5B044` | 蓝紫 `#8B7CF6` |
| 卡片 | 白色 `#FFFFFF` | 深色 `#1A1932` |

### 分类颜色

- 🔄 转专业 - 蓝色
- 🎓 保研 - 绿色
- 📚 考研 - 橙色
- ✈️ 出国留学 - 紫色
- 💼 就业 - 青色
- 💡 其他 - 灰色

## 功能特性

- ✅ GitHub OAuth 登录
- ✅ 在线 Markdown 编辑器（实时预览）
- ✅ 文章搜索（标题、内容、标签、作者）
- ✅ 按分类筛选文章
- ✅ 按专业分类展示
- ✅ 响应式设计
- ✅ 暗色/亮色主题切换
- ✅ 自动创建 Pull Request

## 贡献指南

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License
