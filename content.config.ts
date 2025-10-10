import { defineCollection, defineContentConfig, z } from '@nuxt/content'

export default defineContentConfig({
  collections: {
    // User Guides
    docs: defineCollection({
      type: 'page',
      source: {
        include: 'docs/**/*.md',
        exclude: ['docs/README.md']
      },
      schema: z.object({
        links: z.array(z.object({
          label: z.string(),
          icon: z.string(),
          to: z.string(),
          target: z.string().optional()
        })).optional()
      })
    })
  }
})
