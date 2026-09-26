import "package:flutter/material.dart";
import "package:flutter_dotenv/flutter_dotenv.dart";
import "package:supabase_flutter/supabase_flutter.dart";

import "env.dart";
import "session.dart";
import "tally_api.dart";
import "theme.dart";
import "screens/login_screen.dart";
import "screens/posts_screen.dart";
import "widgets/brand.dart";

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  for (final name in [".env", ".env.example"]) {
    try {
      await dotenv.load(fileName: name, isOptional: true);
      if (dotenv.isInitialized && dotenv.env.isNotEmpty) break;
    } catch (_) {}
  }

  if (Env.isConfigured) {
    await Supabase.initialize(
      url: Env.supabaseUrl,
      publishableKey: Env.supabaseAnonKey,
    );
  }

  runApp(const GeciTallyApp());
}

class GeciTallyApp extends StatefulWidget {
  const GeciTallyApp({super.key});

  @override
  State<GeciTallyApp> createState() => _GeciTallyAppState();
}

class _GeciTallyAppState extends State<GeciTallyApp> {
  SessionController? _session;
  TallyApi? _api;

  @override
  void initState() {
    super.initState();
    if (Env.isConfigured) {
      _api = TallyApi(Supabase.instance.client);
      _session = SessionController(_api!);
    }
  }

  @override
  void dispose() {
    _session?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: "GECI Tally",
      debugShowCheckedModeBanner: false,
      theme: geciTheme(),
      home: _session == null || _api == null
          ? const _MissingConfigScreen()
          : _AuthGate(session: _session!, api: _api!),
    );
  }
}

class _AuthGate extends StatelessWidget {
  const _AuthGate({required this.session, required this.api});

  final SessionController session;
  final TallyApi api;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: session,
      builder: (context, _) {
        if (!session.ready) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }
        if (session.user == null || !session.isStaff) {
          return LoginScreen(session: session);
        }
        return PostsScreen(session: session, api: api);
      },
    );
  }
}

class _MissingConfigScreen extends StatelessWidget {
  const _MissingConfigScreen();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: const [
              BrandLockup(),
              SizedBox(height: 24),
              Text(
                "Supabase is not configured",
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
              ),
              SizedBox(height: 8),
              Text(
                "Copy mobile/.env.example to mobile/.env and set SUPABASE_URL and SUPABASE_ANON_KEY (the same public values as the web app). Then run the app again. Do not put the service role key in the mobile app.",
                style: TextStyle(color: GeciColors.mutedForeground, height: 1.4),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
