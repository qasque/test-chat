import 'dart:convert';

import 'package:http/http.dart' as http;

/// Клиент к telegram-bridge: [POST /mobile/v1/auth/login](https://github.com/qasque/test-chat).
/// [baseUrl] — корень прокси, например `https://portal.example.com/api/bridge` (без слэша в конце).
class MobileGatewayApi {
  MobileGatewayApi(this.baseUrl);

  final String baseUrl;

  String get _root => baseUrl.trim().replaceAll(RegExp(r'/+$'), '');

  Uri _uri(String path) {
    final p = path.startsWith('/') ? path : '/$path';
    return Uri.parse('$_root$p');
  }

  Future<String> login({
    required String email,
    required String password,
  }) async {
    final res = await http.post(
      _uri('/mobile/v1/auth/login'),
      headers: const {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: jsonEncode({'email': email.trim(), 'password': password}),
    );
    final decoded = res.body.isNotEmpty ? jsonDecode(res.body) : null;
    if (res.statusCode >= 200 &&
        res.statusCode < 300 &&
        decoded is Map<String, dynamic> &&
        decoded['accessToken'] is String) {
      return decoded['accessToken'] as String;
    }
    throw MobileGatewayException(res.statusCode, decoded);
  }

  Future<void> logout(String bearerJwt) async {
    await http.post(
      _uri('/mobile/v1/auth/logout'),
      headers: {
        'Authorization': 'Bearer $bearerJwt',
        'Accept': 'application/json',
      },
    );
  }

  /// Проверка сессии: прокси к Chatwoot `GET /api/v1/profile`.
  Future<Map<String, dynamic>> fetchProfile(String bearerJwt) async {
    final res = await http.get(
      _uri('/mobile/v1/cw/api/v1/profile'),
      headers: {
        'Authorization': 'Bearer $bearerJwt',
        'Accept': 'application/json',
      },
    );
    final decoded = res.body.isNotEmpty ? jsonDecode(res.body) : null;
    if (res.statusCode >= 200 && res.statusCode < 300 && decoded is Map<String, dynamic>) {
      return decoded;
    }
    throw MobileGatewayException(res.statusCode, decoded);
  }
}

class MobileGatewayException implements Exception {
  MobileGatewayException(this.statusCode, this.body);

  final int statusCode;
  final Object? body;

  @override
  String toString() {
    if (body is Map && (body as Map)['error'] != null) {
      return 'HTTP $statusCode: ${(body as Map)['error']}';
    }
    return 'HTTP $statusCode';
  }
}
