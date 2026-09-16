import 'dart:async';

import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'app/astro_soul_path_app.dart';
import 'core/config/supabase_config.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  runApp(const _BootstrapApp());
}

class _BootstrapApp extends StatefulWidget {
  const _BootstrapApp();

  @override
  State<_BootstrapApp> createState() => _BootstrapAppState();
}

class _BootstrapAppState extends State<_BootstrapApp> {
  late Future<void> _bootstrapFuture;

  @override
  void initState() {
    super.initState();

    _bootstrapFuture = Future.wait<void>([
      _bootstrap(),
      Future<void>.delayed(const Duration(milliseconds: 2500)),
    ]);
  }

  Future<void> _bootstrap() async {
    try {
      debugPrint('BOOTSTRAP: validating Supabase config...');

      SupabaseConfig.validate();

      debugPrint('BOOTSTRAP: Supabase config valid.');
      debugPrint('BOOTSTRAP: initializing Supabase...');

      await Supabase.initialize(
        url: SupabaseConfig.url,
        publishableKey: SupabaseConfig.anonKey,
        authOptions: const FlutterAuthClientOptions(
          authFlowType: AuthFlowType.pkce,
        ),
      );

      debugPrint('BOOTSTRAP: Supabase initialized successfully.');
    } catch (error, stackTrace) {
      debugPrint('BOOTSTRAP ERROR TYPE: ${error.runtimeType}');
      debugPrint('BOOTSTRAP ERROR: $error');
      debugPrintStack(label: 'BOOTSTRAP STACK', stackTrace: stackTrace);
      rethrow;
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<void>(
      future: _bootstrapFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.done &&
            !snapshot.hasError) {
          return const AstroSoulPathApp();
        }

        if (snapshot.hasError) {
          return MaterialApp(
            debugShowCheckedModeBanner: false,
            home: _StartupFailureScreen(
              onRetry: () {
                setState(() {
                  _bootstrapFuture = _bootstrap();
                });
              },
            ),
          );
        }

        return const MaterialApp(
          debugShowCheckedModeBanner: false,
          home: _StartupLoadingScreen(),
        );
      },
    );
  }
}

class _StartupLoadingScreen extends StatelessWidget {
  const _StartupLoadingScreen();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: Color(0xFF020B18),
      body: SizedBox.expand(
        child: Image(
          image: AssetImage(
            'assets/branding/astro_soul_path_premium_splash.png',
          ),
          fit: BoxFit.cover,
          alignment: Alignment.center,
          filterQuality: FilterQuality.high,
        ),
      ),
    );
  }
}

class _StartupFailureScreen extends StatelessWidget {
  const _StartupFailureScreen({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF071936),
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.cloud_off_rounded,
                  color: Color(0xFFFFD166),
                  size: 54,
                ),
                const SizedBox(height: 20),
                const Text(
                  'Unable to start securely',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 21,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 10),
                const Text(
                  'Please check your connection and try again. '
                  'If the issue continues, install the latest version of the app.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Color(0xFFB8C1D5),
                    fontSize: 13,
                    height: 1.45,
                  ),
                ),
                const SizedBox(height: 24),
                FilledButton.icon(
                  onPressed: onRetry,
                  icon: const Icon(Icons.refresh_rounded),
                  label: const Text('Try again'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
