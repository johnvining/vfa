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
  from: z.string().optional(),        // hometown / town of origin — renders as "(of X)"
  widowOf: z.string().optional(),     // note like "her second marriage"
  parents: z.string().optional(),
  birth: datePlace,
  death: datePlace,
  burial,
});

const divorce = z.object({
  date: z.string().optional(),
  place: z.string().optional(),
  note: z.string().optional(),     // parenthetical like "she m. (2) Floyd J. Tremper"
}).optional();

const childMarriage = z.object({
  number: z.union([z.number(), z.string()]).optional(),
  date: z.string().optional(),
  place: z.string().optional(),
  spouse: z.string().optional(),
  spouseDeath: z.string().optional(),
  note: z.string().optional(),
  divorce,
});

const child = z.object({
  name: z.string(),
  entryId: z.string().optional(),
  entryLetter: z.string().optional(),
  hasUnlistedChildren: z.boolean().optional(),
  leadingDash: z.boolean().optional(),
  birth: datePlace,
  baptism: datePlace,
  adoptedDate: z.string().optional(),
  marriages: z.array(childMarriage).optional(),
  middleNote: z.string().optional(),  // segment after marriages, before death (no "m." prefix)
  note: z.string().optional(),
  death: datePlace,
  burial,
});

const marriage = z.object({
  number: z.union([z.number(), z.string()]).optional(),
  date: z.string().optional(),
  place: z.string().optional(),
  note: z.string().optional(),        // "her second marriage" etc.
  spouse: spouseSchema.optional(),
  divorce,
});

const childrenGroup = z.object({
  spouseRef: z.string().optional(),    // "Sophia A. Ralph" — shown as label when multiple groups
  headingText: z.string().optional(),  // non-standard heading like "child" or "adopted child"
  children: z.array(child),
});

const genealogy = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/genealogy' }),
  schema: z.object({
    id: z.string(),
    letter: z.string(),
    sequence: z.number().optional(),
    lastUpdated: z.string().optional(),
    migrationNote: z.string().optional(),
    relationship: z.enum(['son', 'dau.', 'daughter', 'adopted son', 'adopted dau.', '[adopted?] son', '[adopted?] dau.']).optional(),
    parentId: z.string().optional(),
    parentLetter: z.string().optional(),
    parentDesc: z.string().optional(),
    head: z.object({
      givenName: z.string(),
      surname: z.string().optional(),   // override when surname is non-standard (e.g. "Vinning")
      headingNote: z.string().optional(), // trailing annotation like [sic; ...]
      birth: datePlace,
      baptism: datePlace,
      adoptedDate: z.string().optional(),
      death: datePlace,
      burial,
    }),
    marriages: z.array(marriage).optional(),
    childrenGroups: z.array(childrenGroup).optional(),
    docsUrl: z.string().optional(),
    notes: z.string().optional(),
    rawArchival: z.string().optional(),
    updates: z.array(z.object({
      date: z.string(),           // YYYY-MM or YYYY-MM-DD
      what: z.string().optional(),
      // Each link can be either a bare URL string or an object with an
      // optional name; `url` accepts a single link or an array of them.
      url: z.union([
        z.string(),
        z.object({ url: z.string(), name: z.string().optional() }),
        z.array(z.union([
          z.string(),
          z.object({ url: z.string(), name: z.string().optional() }),
        ])),
      ]).optional(),
      thanks: z.string().optional(),
    })).optional(),
    openQuestions: z.array(z.object({
      posted: z.string(),                     // YYYY-MM or YYYY-MM-DD
      question: z.string(),
      background: z.string().optional(),
      resolved: z.string().optional(),        // YYYY-MM or YYYY-MM-DD; presence marks it answered
      updates: z.array(z.object({
        date: z.string(),
        what: z.string().optional(),
        url: z.union([
          z.string(),
          z.object({ url: z.string(), name: z.string().optional() }),
          z.array(z.union([
            z.string(),
            z.object({ url: z.string(), name: z.string().optional() }),
          ])),
        ]).optional(),
      })).optional(),
    })).optional(),
    leads: z.array(z.object({
      posted: z.string(),                     // YYYY-MM or YYYY-MM-DD
      note: z.string(),
      url: z.union([
        z.string(),
        z.object({ url: z.string(), name: z.string().optional() }),
        z.array(z.union([
          z.string(),
          z.object({ url: z.string(), name: z.string().optional() }),
        ])),
      ]).optional(),
      resolved: z.string().optional(),        // YYYY-MM or YYYY-MM-DD; presence marks it followed-up
    })).optional(),
  }),
});

const letters = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/letters' }),
  schema: z.object({
    letter: z.string(),
    thanks: z.string().optional(),
  }),
});

const genealogyDocs = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/genealogy-docs' }),
  schema: z.object({
    id: z.string(),
    title: z.string(),
    displayTitle: z.string().optional(),
    intro: z.array(z.object({
      caption: z.string().optional(),
      images: z.array(z.object({
        src: z.string(),
        height: z.number().optional(),
      })).optional(),
      inline: z.boolean().optional(),
    })).optional(),
    sections: z.array(z.object({
      type: z.string(),
      heading: z.string().optional(),
      headingLarge: z.boolean().optional(),
      table: z.object({
        columns: z.array(z.string()),
        rows: z.array(z.object({
          label: z.string(),
          indent: z.boolean().optional(),
          values: z.array(z.string()),
        })),
      }).optional(),
      entries: z.array(z.object({
        year: z.string(),
        caption: z.string().optional(),
        images: z.array(z.object({
          src: z.string(),
          height: z.number().optional(),
        })).optional(),
        inline: z.boolean().optional(),
      })).optional(),
      items: z.array(z.object({
        caption: z.string().optional(),
        images: z.array(z.object({
          src: z.string(),
          height: z.number().optional(),
        })).optional(),
        inline: z.boolean().optional(),
      })).optional(),
      text: z.string().optional(),
    })).optional(),
  }),
});

export const collections = { news, genealogy, letters, genealogyDocs };
