import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async ({ redirect }) => {
  // 清除 cookie，设置过期时间为过去
  const cookieValue = [
    'gh_token=',
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=None',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  ].join('; ');

  return new Response(null, {
    status: 302,
    headers: {
      Location: '/submit',
      'Set-Cookie': cookieValue,
    },
  });
};
