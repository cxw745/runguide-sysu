import type { APIRoute } from 'astro';

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

    return new Response(JSON.stringify({
      login: user.login,
      name: user.name || user.login,
      avatar_url: user.avatar_url,
      email,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to fetch user info' }), { status: 500 });
  }
};
