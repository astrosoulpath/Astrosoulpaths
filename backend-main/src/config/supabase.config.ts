export default () => ({
  supabase: {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_ANON_KEY,

    serviceRoleKey:
      process.env.SUPABASE_SERVICE_ROLE_KEY,

    jwtSecret:
      process.env.SUPABASE_JWT_SECRET ??
      process.env.JWT_SECRET,

    jwtAudience:
      process.env.SUPABASE_JWT_AUDIENCE ??
      'authenticated',
  },
});