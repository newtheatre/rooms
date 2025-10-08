// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@vueuse/nuxt',
    'nuxt-auth-utils'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  routeRules: {
    '/api/**': {
      cors: true
    }
  },

  compatibilityDate: '2024-07-11',

  nitro: {
    experimental: {
      openAPI: true,
      wasm: true
    },
    preset: 'cloudflare_module',
    cloudflare: {
      deployConfig: true,
      wrangler: {
        name: 'room-bookings',
        routes: [
          {
            pattern: 'rooms.newtheatre.org.uk',
            custom_domain: true
          }
        ],
        d1_databases: [
          {
            binding: 'DB',
            database_name: 'rooms',
            database_id: '820d8e64-108d-4604-a453-d78595a1e1ef'
          }
        ],
        observability: {
          logs: {
            enabled: true
          }
        }
      }
    }
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
