import "package:flutter_dotenv/flutter_dotenv.dart";

class Env {
  static String get supabaseUrl => _first([
        const String.fromEnvironment("SUPABASE_URL"),
        _dotenv("SUPABASE_URL"),
        _dotenv("NEXT_PUBLIC_SUPABASE_URL"),
      ]);

  static String get supabaseAnonKey => _first([
        const String.fromEnvironment("SUPABASE_ANON_KEY"),
        _dotenv("SUPABASE_ANON_KEY"),
        _dotenv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      ]);

  static bool get isConfigured {
    final url = supabaseUrl;
    final key = supabaseAnonKey;
    if (!url.startsWith("http") || key.isEmpty) return false;
    if (url.contains("your-project.supabase.co")) return false;
    if (key == "your-anon-key") return false;
    return true;
  }

  static String _dotenv(String key) {
    try {
      return dotenv.maybeGet(key)?.trim() ?? "";
    } catch (_) {
      return "";
    }
  }

  static String _first(List<String> values) {
    for (final value in values) {
      if (value.trim().isNotEmpty) return value.trim();
    }
    return "";
  }
}
