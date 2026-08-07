import { loadEnv, defineConfig, Modules } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    cookieOptions: {
      secure: false,
    },
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET,
      cookieSecret: process.env.COOKIE_SECRET,
    }
  },
  modules: {
    [Modules.PAYMENT]: {
      resolve: "@medusajs/medusa/payment",
      options: {
        providers: [
          {
            resolve: "@alchemilla/medusa-razorpay/providers/payment-razorpay/src",
            id: "razorpay",
            options: {
              key_id: process.env.RAZORPAY_ID || "",
              key_secret: process.env.RAZORPAY_SECRET || "",
              razorpay_account: process.env.RAZORPAY_ACCOUNT || "",
              webhook_secret: process.env.RAZORPAY_WEBHOOK_SECRET || "",
              auto_capture: true,
              automatic_expiry_period: 20,
            },
          },
        ],
      },
    },
  },
})
