import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async ({ redirect }) => {
  const clientId = import.meta.env.OAUTH_CLIENT_ID;
  if (!clientId) {
    return new Response(JSON.stringify({ error: 'OAuth client ID not configured' }), { status: 500 });
  }

  // 使用固定的生产环境 URL
  const redirectUri = 'https://runguide-sysu.vercel.app/api/auth/callback';

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'read:user user:email',
    response_type: 'code',
    // 强制每次登录都重新授权，确保用户可以选择不同的账号
    prompt: 'consent',
  });

  return redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
};
