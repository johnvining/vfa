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

const datePlace = z.object({
  date: z.string().optional(),
  place: z.string().optional(),
  lastResidence: z.string().optional(),
}).optional();

const burial = z.object({
  place: z.string().optional(),
  description: z.string().optional(), // cremated, ashes scattered, etc.
}).optional();

const spouseSchema = z.object({
  givenName: z.string().optional(),
  surname: z.string().optional(),
  nee: z.string().optional(),         // maiden name for remarried widows
  widowOf: z.string().optional(),     // note like "her second marriage"
  parents: z.string().optional(),
  birth: datePlace,
  death: datePlace,
  burial,
});

const childMarriage = z.object({
  number: z.number().optional(),
  date: z.string().optional(),
  place: z.string().optional(),
  spouse: z.string().optional(),
  spouseDeath: z.string().optional(),
});

const child = z.object({
  name: z.string(),
  entryId: z.string().optional(),
  entryLetter: z.string().optional(),
  hasUnlistedChildren: z.boolean().optional(),
  birth: datePlace,
  marriages: z.array(childMarriage).optional(),
  death: datePlace,
  burial,
});

const marriage = z.object({
  number: z.number().optional(),
  date: z.string().optional(),
  place: z.string().optional(),
  note: z.string().optional(),        // "her second marriage" etc.
  spouse: spouseSchema.optional(),
});

const childrenGroup = z.object({
  spouseRef: z.string().optional(),   // "Sophia A. Ralph" — shown as label when multiple groups
  children: z.array(child),
});

const genealogy = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/genealogy' }),
  schema: z.object({
    id: z.string(),
    letter: z.string(),
    lastUpdated: z.string().optional(),
    relationship: z.enum(['son', 'dau.']).optional(),
    parentId: z.string().optional(),
    parentLetter: z.string().optional(),
    parentDesc: z.string().optional(),
    head: z.object({
      givenName: z.string(),
      birth: datePlace,
      death: datePlace,
      burial,
    }),
    marriages: z.array(marriage).optional(),
    childrenGroups: z.array(childrenGroup).optional(),
    docsUrl: z.string().optional(),
    notes: z.string().optional(),
    raw: z.string().optional(),
  }),
});

export const collections = { news, genealogy };
