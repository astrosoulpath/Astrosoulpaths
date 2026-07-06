import * as Joi from 'joi';

type RedisValidationEnv = {
  REDIS_URL?: string;
  REDIS_HOST?: string;
  REDIS_PORT?: number;
};

export const envValidationSchema = Joi.object({
  PORT: Joi.number().default(3000),
  REDIS_URL: Joi.string()
    .pattern(/^rediss?:\/\//)
    .optional(),
  REDIS_HOST: Joi.string().optional(),
  REDIS_PORT: Joi.number().optional(),
  REDIS_PASSWORD: Joi.string().optional(),
  REDIS_TLS: Joi.boolean().truthy('true').falsy('false').default(false),

  ENABLE_BULL_BOARD: Joi.boolean().truthy('true').falsy('false').default(false),
  BULL_BOARD_USERNAME: Joi.string().optional(),
  BULL_BOARD_PASSWORD: Joi.string().optional(),

  SUPABASE_URL: Joi.string().required(),
  SUPABASE_ANON_KEY: Joi.string().required(),
  SUPABASE_JWT_SECRET: Joi.string().optional(),
  JWT_SECRET: Joi.string().optional(),
  SUPABASE_JWT_AUDIENCE: Joi.string().optional(),

  DATABASE_URL: Joi.string().required(),
  DIRECT_URL: Joi.string().optional(),

  RAZORPAY_KEY_ID: Joi.string().optional(),
  RAZORPAY_KEY_SECRET: Joi.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: Joi.string().optional(),

  ASTRO_API_KEY: Joi.string().optional(),
  ASTRO_BASE_URL: Joi.string().optional(),

  VEDIC_API_KEY: Joi.string().required().optional(),
  VEDIC_BASE_URL: Joi.string().uri().optional(),

  ASTROLOGY_API_KEY: Joi.string().optional(),
  ASTROLOGY_BASE_URL: Joi.string().optional(),
})
  .custom((value, helpers) => {
    const env = value as RedisValidationEnv;
    const hasRedisUrl = Boolean(env.REDIS_URL);
    const hasRedisParts = Boolean(env.REDIS_HOST || env.REDIS_PORT);
    const isRender = Boolean(process.env.RENDER);

    if (!hasRedisUrl && !hasRedisParts && isRender) {
      return helpers.error('any.custom', {
        message:
          'REDIS_URL is required on Render. Use the Internal Key Value URL in the backend service environment variables.',
      });
    }

    return env;
  }, 'Redis configuration validation')
  .messages({
    'any.custom': '{{#message}}',
  });
