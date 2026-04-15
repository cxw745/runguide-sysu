import type { APIRoute } from 'astro';

export const prerender = false;

// CORS 响应头
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://runguide-sysu.vercel.app',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Credentials': 'true',
};

// OPTIONS 请求处理（预检请求）
export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
};

// 检查用户是否为管理员
async function checkAdmin(token: string, repo: string, githubToken: string): Promise<{ isAdmin: boolean; user?: { login: string } }> {
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
        Authorization: `Bearer ${githubToken}`,
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

// GET - 获取待审核的 PR 列表
export const GET: APIRoute = async ({ cookies }) => {
  const token = cookies.get('gh_token')?.value;

  if (!token) {
    return new Response(JSON.stringify({ error: '请先登录' }), {
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

  // 检查管理员权限
  const { isAdmin } = await checkAdmin(token, repo, githubToken);
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: '只有管理员可以查看 PR 列表' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${githubToken}`,
    Accept: 'application/vnd.github.v3+json',
  };

  try {
    // 获取所有开放的 PR
    const pullsRes = await fetch(`https://api.github.com/repos/${repo}/pulls?state=open&sort=created&direction=desc`, {
      headers,
    });

    if (!pullsRes.ok) {
      const errData = await pullsRes.json() as { message: string };
      return new Response(JSON.stringify({ error: `获取 PR 列表失败: ${errData.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const pulls = await pullsRes.json() as {
      number: number;
      title: string;
      body: string;
      state: string;
      created_at: string;
      user: { login: string; avatar_url: string };
      html_url: string;
      head: { ref: string };
    }[];

    // 过滤出投稿相关的 PR（标题包含"投稿"）
    const articlePRs = pulls.filter(pr => pr.title.includes('投稿'));

    return new Response(JSON.stringify({
      success: true,
      pulls: articlePRs.map(pr => ({
        number: pr.number,
        title: pr.title,
        body: pr.body,
        state: pr.state,
        created_at: pr.created_at,
        user: pr.user,
        html_url: pr.html_url,
        branch: pr.head.ref,
      })),
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching pulls:', error);
    return new Response(JSON.stringify({ error: '获取 PR 列表失败' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

// POST - 合并 PR
export const POST: APIRoute = async ({ request, cookies }) => {
  const token = cookies.get('gh_token')?.value;

  if (!token) {
    return new Response(JSON.stringify({ error: '请先登录' }), {
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

  // 检查管理员权限
  const { isAdmin, user } = await checkAdmin(token, repo, githubToken);
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: '只有管理员可以合并 PR' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json() as { number: number };
  const { number } = body;

  if (!number) {
    return new Response(JSON.stringify({ error: '缺少 PR 编号' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${githubToken}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };

  try {
    // 合并 PR
    const mergeRes = await fetch(`https://api.github.com/repos/${repo}/pulls/${number}/merge`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        commit_title: `Merge PR #${number} (by @${user?.login})`,
        commit_message: '通过文章管理系统合并',
        merge_method: 'merge',
      }),
    });

    if (!mergeRes.ok) {
      const errData = await mergeRes.json() as { message: string };
      return new Response(JSON.stringify({ error: `合并 PR 失败: ${errData.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await mergeRes.json() as { sha: string };

    return new Response(JSON.stringify({
      success: true,
      message: 'PR 合并成功',
      sha: result.sha,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error merging pull:', error);
    return new Response(JSON.stringify({ error: '合并 PR 失败' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};
