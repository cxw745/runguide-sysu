import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ url, redirect, cookies }) => {
  const code = url.searchParams.get('code');

  if (!code) {
    return redirect('/submit?error=no_code');
  }

  const clientId = import.meta.env.OAUTH_CLIENT_ID;
  const clientSecret = import.meta.env.OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return redirect('/submit?error=oauth_not_configured');
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

    if (data.error) {
      return redirect(`/submit?error=${encodeURIComponent(data.error_description || data.error)}`);
    }

    // 使用当前请求的 origin，确保本地开发时跳转回 localhost
    const site = `${url.origin}`;

    cookies.set('gh_token', data.access_token!, {
      path: '/',
      httpOnly: true,
      secure: url.protocol === 'https:',
      sameSite: 'lax',
      maxAge: 86400,
    });

    return redirect(`${site}/submit?auth=success`);
  } catch {
    return redirect('/submit?error=auth_failed');
  }
};
