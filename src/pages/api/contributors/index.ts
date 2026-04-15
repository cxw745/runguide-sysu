import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  const repo = import.meta.env.GITHUB_REPO || 'cxw745/runguide-sysu';
  const githubToken = import.meta.env.GITHUB_TOKEN;

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'sysu-leap-handbook',
  };

  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }

  try {
    const contributorsRes = await fetch(
      `https://api.github.com/repos/${repo}/contributors?per_page=50`,
      { headers }
    );

    // 如果 API 返回 403 或 401，可能是未认证限制，返回空数组
    if (!contributorsRes.ok) {
      console.error('GitHub API error:', contributorsRes.status, await contributorsRes.text());
      // 返回空数组而不是错误，避免页面崩溃
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 's-maxage=3600, stale-while-revalidate=600',
        },
      });
    }

    const contributors = await contributorsRes.json() as { type: string; login: string; avatar_url: string; html_url: string; contributions: number }[];

    const result = contributors
      .filter(c => c.type === 'User')
      .map(c => ({
        login: c.login,
        avatar_url: c.avatar_url,
        html_url: c.html_url,
        contributions: c.contributions,
      }));

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=3600, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('Failed to fetch contributors:', error);
    // 返回空数组而不是错误
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=3600, stale-while-revalidate=600',
      },
    });
  }
};
