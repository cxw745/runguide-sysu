import type { APIRoute } from 'astro';

export const prerender = false;

interface Article {
  slug: string;
  title: string;
  author: string;
  date: string;
  category: string;
  major?: string;
  excerpt: string;
  tags: string[];
  content: string;
  path: string;
  sha: string;
}

// 解析 markdown 文件的 frontmatter
function parseFrontmatter(content: string): Record<string, any> {
  const frontmatter: Record<string, any> = {};
  const match = content.match(/^---\n([\s\S]*?)\n---/);

  if (match) {
    const yamlContent = match[1];
    const lines = yamlContent.split('\n');

    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.slice(0, colonIndex).trim();
        let value = line.slice(colonIndex + 1).trim();

        // 移除引号
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }

        frontmatter[key] = value;
      }
    }

    // 解析 tags 数组
    const tagsMatch = yamlContent.match(/tags:\n([\s\S]*?)(?=\n\w|$)/);
    if (tagsMatch) {
      const tagsLines = tagsMatch[1].split('\n');
      frontmatter.tags = tagsLines
        .map(line => line.trim().replace(/^-\s*"?/, '').replace(/"?$/, ''))
        .filter(Boolean);
    }
  }

  return frontmatter;
}

// 获取文件内容
function getBody(content: string): string {
  const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  return match ? match[1].trim() : content;
}

export const GET: APIRoute = async ({ cookies }) => {
  const token = cookies.get('gh_token')?.value;

  if (!token) {
    return new Response(JSON.stringify({ error: '请先登录' }), { status: 401 });
  }

  // 验证用户身份并检查是否为管理员
  let user;
  try {
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    if (!userRes.ok) {
      return new Response(JSON.stringify({ error: '登录已过期' }), { status: 401 });
    }
    user = await userRes.json() as { login: string };
  } catch {
    return new Response(JSON.stringify({ error: '获取用户信息失败' }), { status: 401 });
  }

  const repo = import.meta.env.GITHUB_REPO || 'cxw745/runguide-sysu';
  const githubToken = import.meta.env.GITHUB_TOKEN;

  if (!githubToken) {
    return new Response(JSON.stringify({ error: '服务端配置错误' }), { status: 500 });
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${githubToken}`,
    Accept: 'application/vnd.github.v3+json',
  };

  try {
    // 获取仓库协作者列表
    const collaboratorsRes = await fetch(`https://api.github.com/repos/${repo}/collaborators`, {
      headers,
    });

    if (!collaboratorsRes.ok) {
      return new Response(JSON.stringify({ error: '无法获取协作者信息' }), { status: 403 });
    }

    const collaborators = await collaboratorsRes.json() as { login: string }[];
    const isAdmin = collaborators.some(c => c.login.toLowerCase() === user.login.toLowerCase());

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: '只有管理员可以查看文章列表' }), { status: 403 });
    }

    // 获取文章目录下的所有文件
    const contentsRes = await fetch(`https://api.github.com/repos/${repo}/contents/src/content/articles`, {
      headers,
    });

    if (!contentsRes.ok) {
      return new Response(JSON.stringify({ error: '无法获取文章列表' }), { status: 500 });
    }

    const files = await contentsRes.json() as { name: string; path: string; sha: string; download_url: string }[];

    // 过滤出 markdown 文件并获取内容
    const articles: Article[] = [];

    for (const file of files) {
      if (!file.name.endsWith('.md')) continue;

      try {
        const contentRes = await fetch(file.download_url);
        if (!contentRes.ok) continue;

        const content = await contentRes.text();
        const frontmatter = parseFrontmatter(content);
        const body = getBody(content);

        articles.push({
          slug: file.name.replace('.md', ''),
          title: frontmatter.title || file.name,
          author: frontmatter.author || '未知',
          date: frontmatter.date || '',
          category: frontmatter.category || '其他',
          major: frontmatter.major || '',
          excerpt: frontmatter.excerpt || '',
          tags: frontmatter.tags || [],
          content: body,
          path: file.path,
          sha: file.sha,
        });
      } catch (e) {
        console.error(`Failed to parse ${file.name}:`, e);
      }
    }

    // 按日期排序（最新的在前）
    articles.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return new Response(JSON.stringify({
      success: true,
      articles,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching articles:', error);
    return new Response(JSON.stringify({ error: '获取文章列表失败' }), { status: 500 });
  }
};
