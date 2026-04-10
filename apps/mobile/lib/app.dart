import 'package:flutter/material.dart';

import 'services/session_repository.dart';
import 'ui/login_page.dart';
import 'ui/operator_shell_page.dart';

class SupportOperatorApp extends StatelessWidget {
  const SupportOperatorApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Поддержка',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF2563EB)),
        useMaterial3: true,
      ),
      home: const _AuthSplash(),
    );
  }
}

class _AuthSplash extends StatefulWidget {
  const _AuthSplash();

  @override
  State<_AuthSplash> createState() => _AuthSplashState();
}

class _AuthSplashState extends State<_AuthSplash> {
  @override
  void initState() {
    super.initState();
    _route();
  }

  Future<void> _route() async {
    final repo = SessionRepository.instance;
    final jwt = await repo.readJwt();
    final base = await repo.readSavedBaseUrl();
    if (!mounted) return;
    if (jwt != null && jwt.isNotEmpty && base != null && base.isNotEmpty) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute<void>(
          builder: (_) => OperatorShellPage(baseUrl: base, initialJwt: jwt),
        ),
      );
    } else {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute<void>(builder: (_) => const LoginPage()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(child: CircularProgressIndicator()),
    );
  }
}
