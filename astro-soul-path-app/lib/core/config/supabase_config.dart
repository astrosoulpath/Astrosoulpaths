class SupabaseConfig {
  SupabaseConfig._();

  static const String url = String.fromEnvironment(
    'SUPABASE_URL',
    defaultValue: '',
  );

  static const String anonKey = String.fromEnvironment(
    'SUPABASE_ANON_KEY',
    defaultValue: '',
  );

  static const String googleWebClientId = String.fromEnvironment(
    'GOOGLE_WEB_CLIENT_ID',
    defaultValue: '',
  );

  static const String googleIosClientId = String.fromEnvironment(
    'GOOGLE_IOS_CLIENT_ID',
    defaultValue: '',
  );

  static bool get isConfigured =>
      url.trim().isNotEmpty && anonKey.trim().isNotEmpty;

  static void validate() {
    if (!isConfigured) {
      throw StateError(
        'Supabase configuration is missing. '
        'Provide SUPABASE_URL and SUPABASE_ANON_KEY using --dart-define.',
      );
    }

    if (googleWebClientId.trim().isEmpty) {
      throw StateError(
        'GOOGLE_WEB_CLIENT_ID is missing. '
        'Provide it using --dart-define.',
      );
    }
  }
}
