import 'package:flutter/material.dart';

import '../services/mobile_gateway_api.dart';
import '../services/session_repository.dart';
import 'login_page.dart';

class OperatorShellPage extends StatefulWidget {
  const OperatorShellPage({
    super.key,
    required this.baseUrl,
    required this.initialJwt,
  });

  final String baseUrl;
  final String initialJwt;

  @override
  State<OperatorShellPage> createState() => _OperatorShellPageState();
}

class _OperatorShellPageState extends State<OperatorShellPage> {
  late String _jwt;
  Map<String, dynamic>? _profile;
  String? _loadError;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _jwt = widget.initialJwt;
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    setState(() {
      _loading = true;
      _loadError = null;
    });
    try {
      final api = MobileGatewayApi(widget.baseUrl);
      final p = await api.fetchProfile(_jwt);
      if (mounted) {
        setState(() {
          _profile = p;
          _loading = false;
        });
      }
    } on MobileGatewayException catch (e) {
      if (e.statusCode == 401) {
        await SessionRepository.instance.clearJwt();
        if (mounted) {
          Navigator.of(context).pushAndRemoveUntil(
            MaterialPageRoute<void>(builder: (_) => const LoginPage()),
            (_) => false,
          );
        }
        return;
      }
      if (mounted) {
        setState(() {
          _loadError = e.toString();
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _loadError = e.toString();
          _loading = false;
        });
      }
    }
  }

  Future<void> _logout() async {
    try {
      await MobileGatewayApi(widget.baseUrl).logout(_jwt);
    } catch (_) {
      /* сеть могла упасть — всё равно чистим локально */
    }
    await SessionRepository.instance.clearJwt();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute<void>(builder: (_) => const LoginPage()),
      (_) => false,
    );
  }

  String _profileLine() {
    final p = _profile;
    if (p == null) return '';
    final id = p['id'];
    final email = p['email'] ?? p['uid'];
    final name = p['name'];
    final parts = <String>[];
    if (name != null && '$name'.isNotEmpty) parts.add('$name');
    if (email != null && '$email'.isNotEmpty) parts.add('$email');
    if (id != null) parts.add('id: $id');
    return parts.join(' · ');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Поддержка'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Выйти',
            onPressed: _logout,
          ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Сессия активна',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 8),
                    if (_loadError != null)
                      Text(
                        _loadError!,
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.error,
                        ),
                      )
                    else
                      Text(
                        _profileLine().isEmpty
                            ? 'Профиль загружен.'
                            : _profileLine(),
                        style: Theme.of(context).textTheme.bodyLarge,
                      ),
                    const SizedBox(height: 24),
                    OutlinedButton.icon(
                      onPressed: _loadProfile,
                      icon: const Icon(Icons.refresh),
                      label: const Text('Обновить профиль'),
                    ),
                  ],
                ),
        ),
      ),
    );
  }
}
