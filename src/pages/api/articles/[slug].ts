import type { APIRoute } from 'astro';

export const prerender = false;

// 检查用户是否为管理员
async function checkAdmin(token: string, repo: string): Promise<{ isAdmin: boolean; user?: { login: string } }> {
  try {
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    if (!userRes.ok) return { isAdmin: false };

    const user = await userRes.json() as { login: string };

    const collaboratorsRes = await fetch(`https://api.github.com/repos/${repo}/collaborators`, {
      headers: {
        Authorization: `Bearer ${import.meta.env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!collaboratorsRes.ok) return { isAdmin: false };

    const collaborators = await collaboratorsRes.json() as { login: string }[];
    const isAdmin = collaborators.some(c => c.login.toLowerCase() === user.login.toLowerCase());

    return { isAdmin, user };
  } catch {
    return { isAdmin: false };
  }
}

// PUT - 更新文章
export const PUT: APIRoute = async ({ params, request, cookies }) => {
  const token = cookies.get('gh_token')?.value;
  if (!token) {
    return new Response(JSON.stringify({ error: '请先登录' }), { status: 401 });
  }

  const slug = params.slug;
  if (!slug) {
    return new Response(JSON.stringify({ error: '文章标识不能为空' }), { status: 400 });
  }

  const repo = import.meta.env.GITHUB_REPO || 'cxw745/runguide-sysu';
  const githubToken = import.meta.env.GITHUB_TOKEN;

  if (!githubToken) {
    return new Response(JSON.stringify({ error: '服务端配置错误' }), { status: 500 });
  }

  // 检查管理员权限
  const { isAdmin, user } = await checkAdmin(token, repo);
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: '只有管理员可以编辑文章' }), { status: 403 });
  }

  const body = await request.json() as {
    title: string;
    author: string;
    category: string;
    major?: string;
    tags: string[];
    excerpt: string;
    content: string;
    sha: string;
  };

  const { title, author, category, major, tags, excerpt, content: articleBody, sha } = body;

  if (!title || !author || !category || !excerpt || !articleBody || !sha) {
    return new Response(JSON.stringify({ error: '请填写所有必填字段' }), { status: 400 });
  }

  const validCategories = ['转专业', '保研', '考研', '出国留学', '就业', '其他'];
  if (!validCategories.includes(category)) {
    return new Response(JSON.stringify({ error: '分类无效' }), { status: 400 });
  }

  const today = new Date().toISOString().split('T')[0];
  const tagsYaml = (tags && tags.length > 0)
    ? `\ntags:\n${tags.map(t => `  - "${t}"`).join('\n')}`
    : '\ntags: []';

  const frontmatter = [
    '---',
    `title: "${title.replace(/"/g, '\\"')}"`,
    `author: "${author.replace(/"/g, '\\"')}"`,
    `date: "${today}"`,
    `category: "${category}"`,
    major ? `major: "${major.replace(/"/g, '\\"')}"` : null,
    tagsYaml,
    `excerpt: "${excerpt.replace(/"/g, '\\"')}"`,
    '---',
    '',
  ].filter(Boolean).join('\n');

  const fullContent = frontmatter + articleBody;
  const encodedContent = btoa(unescape(encodeURIComponent(fullContent)));

  const headers: Record<string, string> = {
    Authorization: `Bearer ${githubToken}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };

  try {
    const filePath = `src/content/articles/${slug}.md`;

    // 更新文件
    const updateFile = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: `编辑文章: ${title} (by @${user?.login})`,
        content: encodedContent,
        sha: sha,
      }),
    });

    if (!updateFile.ok) {
      const errData = await updateFile.json() as { message: string };
      return new Response(JSON.stringify({ error: `更新文件失败: ${errData.message}` }), { status: 500 });
    }

    const result = await updateFile.json() as { content: { html_url: string } };

    return new Response(JSON.stringify({
      success: true,
      message: '文章更新成功',
      url: result.content.html_url,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: '更新失败，请稍后重试' }), { status: 500 });
  }
};

// DELETE - 删除文章
export const DELETE: APIRoute = async ({ params, request, cookies }) => {
  const token = cookies.get('gh_token')?.value;
  if (!token) {
    return new Response(JSON.stringify({ error: '请先登录' }), { status: 401 });
  }

  const slug = params.slug;
  if (!slug) {
    return new Response(JSON.stringify({ error: '文章标识不能为空' }), { status: 400 });
  }

  const repo = import.meta.env.GITHUB_REPO || 'cxw745/runguide-sysu';
  const githubToken = import.meta.env.GITHUB_TOKEN;

  if (!githubToken) {
    return new Response(JSON.stringify({ error: '服务端配置错误' }), { status: 500 });
  }

  // 检查管理员权限
  const { isAdmin, user } = await checkAdmin(token, repo);
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: '只有管理员可以删除文章' }), { status: 403 });
  }

  const body = await request.json().catch(() => ({})) as { sha?: string };
  const sha = body.sha;

  if (!sha) {
    return new Response(JSON.stringify({ error: '缺少文件 SHA' }), { status: 400 });
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${githubToken}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };

  try {
    const filePath = `src/content/articles/${slug}.md`;

    // 删除文件
    const deleteFile = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
      method: 'DELETE',
      headers,
      body: JSON.stringify({
        message: `删除文章: ${slug} (by @${user?.login})`,
        sha: sha,
      }),
    });

    if (!deleteFile.ok) {
      const errData = await deleteFile.json() as { message: string };
      return new Response(JSON.stringify({ error: `删除文件失败: ${errData.message}` }), { status: 500 });
    }

    return new Response(JSON.stringify({
      success: true,
      message: '文章删除成功',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: '删除失败，请稍后重试' }), { status: 500 });
  }
};
