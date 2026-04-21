import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const news = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/news' }),
  schema: z.object({
    date: z.date(),
    season: z.string(),
    title: z.string().optional(),
    showMonthHeading: z.boolean().default(true),
  }),
});

export const collections = { news };
