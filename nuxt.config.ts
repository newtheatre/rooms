// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxt/content',
    '@vueuse/nuxt',
    'nuxt-auth-utils'
  ],

  // Estate SSO (stage-door docs/session-contract.md): this app READS the
  // nnt-session cookie sealed by auth.newtheatre.org.uk — it never writes it.
  $production: {
    runtimeConfig: {
      session: {
        name: 'nnt-session',
        password: '',
        maxAge: 60 * 60 * 24 * 30,
        cookie: { domain: '.newtheatre.org.uk', sameSite: 'lax', secure: true }
      }
    }
  },

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  content: {
    experimental: { sqliteConnector: 'native' },
    database: {
      type: 'd1',
      bindingName: 'DB'
    },
    build: {
      markdown: {
        highlight: {
          theme: 'github-dark'
        }
      }
    }
  },

  runtimeConfig: {
    session: {
      name: 'nnt-session',
      password: '', // NUXT_SESSION_PASSWORD — the estate-wide seal secret
      maxAge: 60 * 60 * 24 * 30
    },
    // Server-to-server calls to the auth service and the inbound GDPR hook
    // bearer. Worker secret NUXT_AUTH_SERVICE_TOKEN — the NUXT_ prefix is
    // load-bearing, since Nuxt only maps NUXT_* env onto runtimeConfig. A
    // secret named AUTH_SERVICE_TOKEN is silently ignored.
    authServiceToken: '',
    public: {
      // The hosted auth service (login/account/refresh). Dev: see /dev-login.
      authBaseURL: 'https://auth.newtheatre.org.uk'
    }
  },

  // The blanket `cors: true` on /api/** did not survive the stage-door
  // integration review — same-origin pages don't need it, and the API now
  // fails closed behind the estate session.

  compatibilityDate: '2025-08-10',

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
        // Estate-wide secrets live in the account Secrets Store (stage-door
        // ADR-0016). server/plugins/0.secrets-store.ts turns the binding into
        // runtimeConfig.session.password — read its header before adding
        // another entry here, the binding name matters.
        //
        // Cast: `secrets_store_secrets` is valid wrangler config but missing
        // from the wrangler types Nitro 2.13 bundles. Drop it once Nitro
        // catches up.
        ...({
          secrets_store_secrets: [
            {
              binding: 'SESSION_PASSWORD',
              store_id: 'fdfe08b6b01f498fbddbc08c2891cadb',
              secret_name: 'NUXT_SESSION_PASSWORD'
            }
          ]
        } as object),
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
