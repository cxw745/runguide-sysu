import type { APIRoute } from 'astro';
import { stateStore } from '../auth/login';

export const prerender = false;

export const GET: APIRoute = async ({ url, cookies }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  // 从 stateStore 获取 redirect 路径
  let redirectPath = '/submit';
  if (state && stateStore.has(state)) {
    const stateData = stateStore.get(state);
    if (stateData && stateData.expires > Date.now()) {
      redirectPath = stateData.redirect;
    }
    // 使用后删除
    stateStore.delete(state);
  }

  if (!code) {
    return new Response(null, {
      status: 302,
      headers: { Location: `${redirectPath}?error=no_code` },
    });
  }

  const clientId = import.meta.env.OAUTH_CLIENT_ID;
  const clientSecret = import.meta.env.OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return new Response(null, {
      status: 302,
      headers: { Location: `${redirectPath}?error=oauth_not_configured` },
    });
  }

  try {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const data = await response.json() as { error?: string; error_description?: string; access_token?: string };

    if (data.error || !data.access_token) {
      const errMsg = encodeURIComponent(data.error_description || data.error || 'no_token');
      return new Response(null, {
        status: 302,
        headers: { Location: `${redirectPath}?error=${errMsg}` },
      });
    }

    // 使用固定的生产环境 URL，避免 Vercel Edge 返回 localhost
    const baseUrl = 'https://runguide-sysu.vercel.app';
    const redirectUrl = `${baseUrl}${redirectPath}?auth=success`;

    // 生产环境必须使用 SameSite=None 和 Secure 才能跨域设置 cookie
    const cookieValue = [
      `gh_token=${data.access_token}`,
      'Path=/',
      'HttpOnly',
      'Secure',
      'SameSite=None',
      'Max-Age=86400',
    ].join('; ');

    return new Response(null, {
      status: 302,
      headers: {
        Location: redirectUrl,
        'Set-Cookie': cookieValue,
      },
    });
  } catch {
    return new Response(null, {
      status: 302,
      headers: { Location: `${redirectPath}?error=auth_failed` },
    });
  }
};
