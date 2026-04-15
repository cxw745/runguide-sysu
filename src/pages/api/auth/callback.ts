import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ url, cookies }) => {
  const code = url.searchParams.get('code');

  if (!code) {
    return new Response(null, {
      status: 302,
      headers: { Location: '/submit?error=no_code' },
    });
  }

  const clientId = import.meta.env.OAUTH_CLIENT_ID;
  const clientSecret = import.meta.env.OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return new Response(null, {
      status: 302,
      headers: { Location: '/submit?error=oauth_not_configured' },
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
        headers: { Location: `/submit?error=${errMsg}` },
      });
    }

    const isSecure = url.protocol === 'https:';
    const redirectUrl = `${url.origin}/submit?auth=success`;

    const cookieValue = [
      `gh_token=${data.access_token}`,
      'Path=/',
      'HttpOnly',
      isSecure ? 'Secure' : '',
      'SameSite=Lax',
      'Max-Age=86400',
    ].filter(Boolean).join('; ');

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
      headers: { Location: '/submit?error=auth_failed' },
    });
  }
};
