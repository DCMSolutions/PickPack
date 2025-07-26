import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    // DATABASE_URL: z
    //   .string()
    //   .url()
    //   .refine(
    //     (str) => !str.includes("YOUR_MYSQL_URL_HERE"),
    //     "You forgot to change the default URL",
    //   ),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    APP_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    // Add ` on ID and SECRET if you want to make sure they're not empty
    AZURE_CLIENT_ID: z.string(),
    AZURE_CLIENT_SECRET: z.string(),
    AZURE_TENANT_ID: z.string(),
    SERVER_URL: z.string().url(),
    SENDGRID_API_KEY: z.string(),
    MAIL_SENDER: z.string(),

    TOKEN_EMPRESA: z.string(),
    CLERK_SECRET_KEY: z.string(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    // NEXT_PUBLIC_CLIENTVAR: z.string(),
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    // DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    AZURE_CLIENT_ID: process.env.AZURE_CLIENT_ID,
    AZURE_CLIENT_SECRET: process.env.AZURE_CLIENT_SECRET,
    AZURE_TENANT_ID: process.env.AZURE_TENANT_ID,
    SERVER_URL: process.env.SERVER_URL,
    SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
    MAIL_SENDER: process.env.MAIL_SENDER,
    TOKEN_EMPRESA: process.env.TOKEN_EMPRESA,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    APP_ENV: process.env.APP_ENV,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined.
   * `SOME_VAR: z.string()` and `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
