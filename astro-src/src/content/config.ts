import { defineCollection, z } from 'astro:content';

const news = defineCollection({
  type: 'content',
  schema: z.object({
    date: z.date(),
    season: z.string(),
    title: z.string().optional(),
  }),
});

export const collections = { news };
