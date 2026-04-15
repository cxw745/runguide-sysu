import type { APIRoute } from 'astro';

export const prerender = false;

// 缓存协作者列表，避免频繁请求 GitHub API
let cachedCollaborators: string[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 分钟缓存

async function getCollaborators(repo: string, githubToken: string): Promise<string[]> {
  // 检查缓存
  if (cachedCollaborators && Date.now() - cacheTime < CACHE_TTL) {
    return cachedCollaborators;
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/collaborators`, {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!res.ok) {
      console.error('Failed to fetch collaborators:', await res.text());
      return cachedCollaborators || [];
    }

    const collaborators = await res.json() as { login: string }[];
    cachedCollaborators = collaborators.map(c => c.login.toLowerCase());
    cacheTime = Date.now();
    return cachedCollaborators;
  } catch (error) {
    console.error('Error fetching collaborators:', error);
    return cachedCollaborators || [];
  }
}

export const GET: APIRoute = async ({ cookies }) => {
  const token = cookies.get('gh_token')?.value;

  if (!token) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401 });
  }

  try {
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!userRes.ok) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401 });
    }

    const user = await userRes.json() as { login: string; name: string; avatar_url: string; email: string | null };

    let email = user.email;
    if (!email) {
      const emailsRes = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });
      if (emailsRes.ok) {
        const emails = await emailsRes.json() as { primary: boolean; email: string }[];
        const primary = emails.find(e => e.primary);
        email = primary ? primary.email : (emails[0] ? emails[0].email : '');
      }
    }

    // 检查用户是否是仓库协作者（管理员）
    const repo = import.meta.env.GITHUB_REPO || 'cxw745/runguide-sysu';
    const githubToken = import.meta.env.GITHUB_TOKEN;
    let isAdmin = false;

    if (githubToken) {
      const collaborators = await getCollaborators(repo, githubToken);
      isAdmin = collaborators.includes(user.login.toLowerCase());
    }

    return new Response(JSON.stringify({
      login: user.login,
      name: user.name || user.login,
      avatar_url: user.avatar_url,
      email,
      isAdmin,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to fetch user info' }), { status: 500 });
  }
};
