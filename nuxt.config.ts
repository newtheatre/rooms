// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxt/content',
    '@nuxthub/core',
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
    },

    hub: {
      db: {
        dialect: 'sqlite',
        driver: 'd1', // FIXME: https://github.com/nuxt-hub/core/pull/775 (same as the rest of the estate)
        connection: { databaseId: '820d8e64-108d-4604-a453-d78595a1e1ef' }
      },
      kv: false,
      cache: false,
      blob: false
    }
  },

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  content: {
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
    // Worker secret NUXT_AUTH_SERVICE_TOKEN. The NUXT_ prefix is load-bearing —
    // a secret named AUTH_SERVICE_TOKEN is silently ignored.
    authServiceToken: '',
    public: {
      // The hosted auth service (login/account/refresh). Dev: see /dev-login.
      authBaseURL: 'https://auth.newtheatre.org.uk'
    }
  },

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
        // Estate secrets come from the Secrets Store (stage-door ADR-0016); the
        // binding name matters — read server/plugins/0.secrets-store.ts first.

        // Cast: `secrets_store_secrets` is valid wrangler config but missing from
        // the wrangler types Nitro bundles. Drop it once Nitro catches up.
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

  hub: {
    db: 'sqlite',
    kv: false,
    cache: false,
    blob: false
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
