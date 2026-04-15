import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ redirect, url }) => {
  const clientId = import.meta.env.OAUTH_CLIENT_ID;
  if (!clientId) {
    return new Response(JSON.stringify({ error: 'OAuth client ID not configured' }), { status: 500 });
  }

  // 使用当前请求的 origin，确保本地开发时用 localhost
  const redirectUri = `${url.origin}/api/auth/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'read:user user:email',
    response_type: 'code',
  });

  return redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
};
