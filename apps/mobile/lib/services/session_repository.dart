import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _kJwtKey = 'mobile_gateway_jwt';
const _kBaseUrlKey = 'gateway_base_url';
const _kLastEmailKey = 'last_login_email';

class SessionRepository {
  SessionRepository._();

  static final SessionRepository instance = SessionRepository._();

  final FlutterSecureStorage _secure = const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  Future<String?> readJwt() => _secure.read(key: _kJwtKey);

  Future<void> writeJwt(String token) => _secure.write(key: _kJwtKey, value: token);

  Future<void> clearJwt() => _secure.delete(key: _kJwtKey);

  Future<String?> readSavedBaseUrl() async {
    final p = await SharedPreferences.getInstance();
    final v = p.getString(_kBaseUrlKey);
    return v?.trim().isEmpty ?? true ? null : v!.trim();
  }

  Future<void> writeSavedBaseUrl(String url) async {
    final p = await SharedPreferences.getInstance();
    await p.setString(_kBaseUrlKey, url.trim());
  }

  Future<String?> readLastEmail() async {
    final p = await SharedPreferences.getInstance();
    return p.getString(_kLastEmailKey);
  }

  Future<void> writeLastEmail(String email) async {
    final p = await SharedPreferences.getInstance();
    await p.setString(_kLastEmailKey, email.trim());
  }
}
