import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async () => {
  const repo = import.meta.env.GITHUB_REPO || 'cxw745/runguide-sysu';
  const githubToken = import.meta.env.GITHUB_TOKEN;

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };

  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }

  try {
    // 获取所有贡献者（包括代码提交者）
    const contributorsRes = await fetch(
      `https://api.github.com/repos/${repo}/contributors?per_page=100`,
      { headers }
    );

    // 获取所有协作者
    const collaboratorsRes = await fetch(
      `https://api.github.com/repos/${repo}/collaborators?per_page=100`,
      { headers }
    );

    // 获取所有已合并的 PR 作者
    const pullsRes = await fetch(
      `https://api.github.com/repos/${repo}/pulls?state=closed&per_page=100`,
      { headers }
    );

    const contributors = contributorsRes.ok 
      ? await contributorsRes.json() as { type: string; login: string; avatar_url: string; html_url: string; contributions: number }[]
      : [];

    const collaborators = collaboratorsRes.ok
      ? await collaboratorsRes.json() as { login: string; avatar_url: string; html_url: string }[]
      : [];

    const pulls = pullsRes.ok
      ? await pullsRes.json() as { user: { login: string; avatar_url: string; html_url: string }; merged: boolean }[]
      : [];

    // 合并所有贡献者，去重
    const contributorMap = new Map<string, { login: string; avatar_url: string; html_url: string; contributions: number }>();

    // 添加代码贡献者
    contributors
      .filter(c => c.type === 'User')
      .forEach(c => {
        contributorMap.set(c.login, {
          login: c.login,
          avatar_url: c.avatar_url,
          html_url: c.html_url,
          contributions: c.contributions,
        });
      });

    // 添加协作者
    collaborators.forEach(c => {
      if (!contributorMap.has(c.login)) {
        contributorMap.set(c.login, {
          login: c.login,
          avatar_url: c.avatar_url,
          html_url: c.html_url,
          contributions: 0,
        });
      }
    });

    // 添加已合并 PR 的作者
    pulls
      .filter(pr => pr.merged)
      .forEach(pr => {
        const user = pr.user;
        if (!contributorMap.has(user.login)) {
          contributorMap.set(user.login, {
            login: user.login,
            avatar_url: user.avatar_url,
            html_url: user.html_url,
            contributions: 0,
          });
        }
      });

    const result = Array.from(contributorMap.values());

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=3600, stale-while-revalidate=600',
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to fetch contributors' }), { status: 500 });
  }
};
