import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  const repo = import.meta.env.GITHUB_REPO || 'cxw745/runaway745';
  const githubToken = import.meta.env.GITHUB_TOKEN;

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };

  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }

  try {
    const contributorsRes = await fetch(
      `https://api.github.com/repos/${repo}/contributors?per_page=50`,
      { headers }
    );

    if (!contributorsRes.ok) {
      return new Response(JSON.stringify({ error: 'Failed to fetch contributors' }), { status: contributorsRes.status });
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
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to fetch contributors' }), { status: 500 });
  }
};
