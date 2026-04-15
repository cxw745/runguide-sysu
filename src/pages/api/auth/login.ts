import type { APIRoute } from 'astro';

export const prerender = false;

// 简单的状态存储（生产环境应该使用 Redis 或数据库）
const stateStore = new Map<string, { redirect: string; expires: number }>();

// 清理过期的状态
function cleanupExpiredStates() {
  const now = Date.now();
  for (const [key, value] of stateStore.entries()) {
    if (value.expires < now) {
      stateStore.delete(key);
    }
  }
}

export const GET: APIRoute = async ({ url, redirect }) => {
  const clientId = import.meta.env.OAUTH_CLIENT_ID;
  if (!clientId) {
    return new Response(JSON.stringify({ error: 'OAuth client ID not configured' }), { status: 500 });
  }

  // 获取用户想要登录后跳转的页面，默认为 /submit
  const redirectPath = url.searchParams.get('redirect') || '/submit';

  // 生成随机 state 参数
  const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  
  // 存储 state 和 redirect 路径（10分钟过期）
  cleanupExpiredStates();
  stateStore.set(state, {
    redirect: redirectPath,
    expires: Date.now() + 10 * 60 * 1000,
  });

  // 使用固定的生产环境 URL
  const redirectUri = 'https://runguide-sysu.vercel.app/api/auth/callback';

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'read:user user:email',
    response_type: 'code',
    state: state,
    // 强制每次登录都重新授权，确保用户可以选择不同的账号
    prompt: 'consent',
  });

  return redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
};

// 导出 stateStore 供 callback 使用
export { stateStore };
