import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const clientId = import.meta.env.OAUTH_CLIENT_ID;
  if (!clientId) {
    return new Response(JSON.stringify({ error: 'OAuth client ID not configured' }), { status: 500 });
  }

  // 获取用户想要登录后跳转的页面，默认为 /submit
  const redirectPath = url.searchParams.get('redirect') || '/submit';

  // 使用固定的生产环境 URL
  const redirectUri = `https://runguide-sysu.vercel.app/api/auth/callback?redirect=${encodeURIComponent(redirectPath)}`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'read:user user:email',
    response_type: 'code',
    // 强制每次登录都重新授权，确保用户可以选择不同的账号
    prompt: 'consent',
  });

  const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;

  return new Response(null, {
    status: 302,
    headers: { Location: authUrl },
  });
};
