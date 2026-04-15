import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    author: z.string(),
    date: z.string(),
    category: z.enum(['转专业', '保研', '考研', '出国留学', '就业', '其他']),
    major: z.string().default(''),
    tags: z.array(z.string()).default([]),
    excerpt: z.string(),
  }),
});

export const collections = { articles };
