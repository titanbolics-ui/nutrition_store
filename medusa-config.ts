import { loadEnv, defineConfig, Modules } from "@medusajs/framework/utils";

loadEnv(process.env.NODE_ENV || "development", process.cwd());

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    workerMode:
      (process.env.MEDUSA_WORKER_MODE as "shared" | "worker" | "server") ||
      "shared",
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    },
  },
  admin: {
    backendUrl: process.env.MEDUSA_BACKEND_URL,
    vite: () => ({
      resolve: {
        dedupe: ["react", "react-dom", "react-router-dom", "@tanstack/react-query"],
      },
    }),
  },
  modules: [
    {
      resolve: "@medusajs/medusa/payment",
      options: {
        providers: [
          {
            resolve: "./src/modules/payment/providers/crypto-manual",
            id: "crypto-manual",
            options: {},
          },
          {
            resolve: "./src/modules/payment/providers/paypal-manual",
            id: "paypal-manual",
            options: {},
          },
          {
            resolve: "./src/modules/payment/providers/cash-app",
            id: "cash-app",
            options: {},
          },
          {
            resolve: "./src/modules/payment/providers/card-manual",
            id: "card-manual",
            options: {},
          },
        ],
      },
    },
    {
      resolve: "@medusajs/medusa/notification",
      options: {
        providers: [
          {
            resolve: "./src/modules/resend",
            id: "resend",
            options: {
              channels: ["email"],
              api_key: process.env.RESEND_API_KEY,
              from: process.env.RESEND_FROM_EMAIL,
              transport:
                (process.env.EMAIL_TRANSPORT as "resend" | "smtp") || "resend",
              smtp_host: process.env.SMTP_HOST,
              smtp_port: process.env.SMTP_PORT
                ? Number(process.env.SMTP_PORT)
                : undefined,
              smtp_secure: process.env.SMTP_SECURE === "true",
              smtp_user: process.env.SMTP_USER,
              smtp_pass: process.env.SMTP_PASS,
            },
          },
          {
            resolve: "@medusajs/medusa/notification-local",
            id: "local-notification",
            options: {
              channels: ["feed"],
            },
          },
        ],
      },
    },
    {
      resolve: "@medusajs/medusa/file",
      options: {
        providers: [
          process.env.S3_ACCESS_KEY_ID
            ? {
                resolve: "@medusajs/medusa/file-s3",
                id: "s3",
                options: {
                  file_url: process.env.S3_FILE_URL,
                  access_key_id: process.env.S3_ACCESS_KEY_ID,
                  secret_access_key: process.env.S3_SECRET_ACCESS_KEY,
                  region: process.env.S3_REGION,
                  bucket: process.env.S3_BUCKET,
                  endpoint: process.env.S3_ENDPOINT,
                },
              }
            : {
                resolve: "@medusajs/medusa/file-local",
                id: "local",
                options: {
                  upload_dir: "uploads",
                  backend_url: "http://localhost:9000",
                },
              },
        ],
      },
    },
    {
      resolve: "@medusajs/event-bus-redis",
      key: Modules.EVENT_BUS,
      options: {
        redisUrl: process.env.REDIS_URL,
      },
    },
    {
      resolve: "@medusajs/medusa/cache-redis",
      options: {
        redisUrl: process.env.REDIS_URL,
      },
    },
    {
      resolve: "@medusajs/medusa/workflow-engine-redis",
      options: {
        redis: {
          url: process.env.REDIS_URL,
        },
      },
    },
  ],
  plugins: [
    { resolve: "@medusajs/loyalty-plugin", options: {} },
    {
      resolve: "@medusajs/analytics-posthog",
      options: {
        posthog_api_key: process.env.POSTHOG_API_KEY,
      },
    },
  ],
});
