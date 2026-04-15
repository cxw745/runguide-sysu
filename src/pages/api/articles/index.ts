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

// CORS 响应头
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://runguide-sysu.vercel.app',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Credentials': 'true',
};

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
    // 匹配 tags: [] 或 tags:\n  - "xxx"\n  - "yyy" 格式
    const tagsMatch = yamlContent.match(/tags:\s*(\[.*?\]|\n([\s\S]*?))(?=\n\w|$)/);
    if (tagsMatch) {
      const tagsContent = tagsMatch[1];
      // 如果是 [] 格式
      if (tagsContent.trim().startsWith('[')) {
        try {
          // 尝试解析 JSON 格式的数组
          const cleaned = tagsContent.replace(/'/g, '"');
          frontmatter.tags = JSON.parse(cleaned);
        } catch {
          // 解析失败则设为空数组
          frontmatter.tags = [];
        }
      } else {
        // 解析列表格式
        const tagsLines = tagsContent.split('\n');
        frontmatter.tags = tagsLines
          .map(line => line.trim().replace(/^-\s*"?/, '').replace(/"?$/, ''))
          .filter(Boolean);
      }
    }
  }

  return frontmatter;
}

// 获取文件内容
function getBody(content: string): string {
  // 匹配 ---\n...\n--- 或 ---\r\n...\r\n--- 格式，后面可以跟换行符或直接跟内容
  const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?([\s\S]*)$/);
  return match ? match[1].trim() : content;
}

// OPTIONS 请求处理（预检请求）
export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
};

export const GET: APIRoute = async ({ cookies }) => {
  const token = cookies.get('gh_token')?.value;

  if (!token) {
    return new Response(JSON.stringify({ error: '请先登录' }), { 
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
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
      return new Response(JSON.stringify({ error: '登录已过期' }), { 
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    user = await userRes.json() as { login: string };
  } catch {
    return new Response(JSON.stringify({ error: '获取用户信息失败' }), { 
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const repo = import.meta.env.GITHUB_REPO || 'cxw745/runguide-sysu';
  const githubToken = import.meta.env.GITHUB_TOKEN;

  if (!githubToken) {
    return new Response(JSON.stringify({ error: '服务端配置错误' }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
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
      return new Response(JSON.stringify({ error: '无法获取协作者信息' }), { 
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const collaborators = await collaboratorsRes.json() as { login: string }[];
    const isAdmin = collaborators.some(c => c.login.toLowerCase() === user.login.toLowerCase());

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: '只有管理员可以查看文章列表' }), { 
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 获取文章目录下的所有文件
    const contentsRes = await fetch(`https://api.github.com/repos/${repo}/contents/src/content/articles`, {
      headers,
    });

    if (!contentsRes.ok) {
      return new Response(JSON.stringify({ error: '无法获取文章列表' }), { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching articles:', error);
    return new Response(JSON.stringify({ error: '获取文章列表失败' }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};
