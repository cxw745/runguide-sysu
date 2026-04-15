import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, cookies }) => {
  const token = cookies.get('gh_token')?.value;

  if (!token) {
    return new Response(JSON.stringify({ error: '请先登录 GitHub' }), { status: 401 });
  }

  const githubToken = import.meta.env.GITHUB_TOKEN;
  const repo = import.meta.env.GITHUB_REPO || 'cxw745/runaway745';

  if (!githubToken) {
    return new Response(JSON.stringify({ error: '服务端 GitHub Token 未配置' }), { status: 500 });
  }

  let user;
  try {
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    if (!userRes.ok) {
      return new Response(JSON.stringify({ error: '登录已过期，请重新登录' }), { status: 401 });
    }
    user = await userRes.json() as { login: string };
  } catch {
    return new Response(JSON.stringify({ error: '获取用户信息失败' }), { status: 401 });
  }

  const body = await request.json() as {
    title: string;
    author: string;
    category: string;
    major: string;
    tags: string[];
    excerpt: string;
    body: string;
  };

  const { title, author, category, major, tags, excerpt, body: articleBody } = body;

  if (!title || !author || !category || !major || !excerpt || !articleBody) {
    return new Response(JSON.stringify({ error: '请填写所有必填字段（标题、作者、分类、专业、摘要、正文）' }), { status: 400 });
  }

  const validCategories = ['转专业', '保研', '考研', '出国留学', '就业', '其他'];
  if (!validCategories.includes(category)) {
    return new Response(JSON.stringify({ error: '分类无效' }), { status: 400 });
  }

  const slugBase = title
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50);

  const shortId = Math.random().toString(36).substring(2, 8);
  const slug = `${slugBase}-${shortId}`;
  const timestamp = Date.now();
  const branchName = `article/${slugBase}-${timestamp}`;

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
    `major: "${major.replace(/"/g, '\\"')}"`,
    tagsYaml,
    `excerpt: "${excerpt.replace(/"/g, '\\"')}"`,
    '---',
    '',
  ].join('\n');

  const fullContent = frontmatter + articleBody;
  const encodedContent = btoa(unescape(encodeURIComponent(fullContent)));

  const ghApi = 'https://api.github.com';
  const headers: Record<string, string> = {
    Authorization: `Bearer ${githubToken}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };

  try {
    const mainRef = await fetch(`${ghApi}/repos/${repo}/git/ref/heads/main`, { headers });
    if (!mainRef.ok) {
      return new Response(JSON.stringify({ error: '无法获取主分支信息' }), { status: 500 });
    }
    const mainData = await mainRef.json() as { object: { sha: string } };
    const sha = mainData.object.sha;

    const createBranch = await fetch(`${ghApi}/repos/${repo}/git/refs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha,
      }),
    });

    if (!createBranch.ok) {
      const errData = await createBranch.json() as { message: string };
      return new Response(JSON.stringify({ error: `创建分支失败: ${errData.message}` }), { status: 500 });
    }

    const filePath = `src/content/articles/${slug}.md`;
    const createFile = await fetch(`${ghApi}/repos/${repo}/contents/${filePath}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: `投稿: ${title} (by @${user.login})`,
        content: encodedContent,
        branch: branchName,
      }),
    });

    if (!createFile.ok) {
      const errData = await createFile.json() as { message: string };
      return new Response(JSON.stringify({ error: `创建文件失败: ${errData.message}` }), { status: 500 });
    }

    const createPR = await fetch(`${ghApi}/repos/${repo}/pulls`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: `投稿: ${title}`,
        head: branchName,
        base: 'main',
        body: [
          `## 投稿信息`,
          '',
          `| 字段 | 内容 |`,
          `|------|------|`,
          `| 标题 | ${title} |`,
          `| 作者 | ${author} |`,
          `| 分类 | ${category} |`,
          `| 专业 | ${major} |`,
          `| 投稿人 | @${user.login} |`,
          `| 日期 | ${today} |`,
          '',
          tags && tags.length > 0 ? `**标签**: ${tags.join(', ')}` : '',
          '',
          `> 本投稿由 [@${user.login}](https://github.com/${user.login}) 通过在线投稿系统提交。`,
        ].filter(Boolean).join('\n'),
      }),
    });

    if (!createPR.ok) {
      const errData = await createPR.json() as { message: string };
      return new Response(JSON.stringify({ error: `创建 PR 失败: ${errData.message}` }), { status: 500 });
    }

    const prData = await createPR.json() as { html_url: string; number: number };

    return new Response(JSON.stringify({
      success: true,
      prUrl: prData.html_url,
      prNumber: prData.number,
      message: '投稿成功！已创建 Pull Request，等待管理员审核。',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: '提交失败，请稍后重试' }), { status: 500 });
  }
};
