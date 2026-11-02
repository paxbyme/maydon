import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

abstract interface class CredentialStore {
  Future<String?> read();
  Future<void> write(String token);
  Future<void> clear();
}

class NativeCredentialStore implements CredentialStore {
  static const _key = 'maydon.refresh.v1';
  final FlutterSecureStorage _storage = const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(
      accessibility: KeychainAccessibility.unlocked_this_device,
    ),
  );
  @override
  Future<String?> read() => _storage.read(key: _key);
  @override
  Future<void> write(String token) => _storage.write(key: _key, value: token);
  @override
  Future<void> clear() => _storage.delete(key: _key);
}

// Browser refresh credentials are owned exclusively by the HttpOnly cookie.
// Never instantiate native/web secure-storage plugins for browser credentials.
class CookieCredentialStore implements CredentialStore {
  @override
  Future<String?> read() async => null;
  @override
  Future<void> write(String token) =>
      throw StateError('Browser tokens must not be persisted');
  @override
  Future<void> clear() async {}
}

abstract interface class LocaleStore {
  Future<String?> read();
  Future<void> write(String locale);
}

class DeviceLocaleStore implements LocaleStore {
  final SharedPreferencesAsync _preferences = SharedPreferencesAsync();
  @override
  Future<String?> read() => _preferences.getString('maydon.locale');
  @override
  Future<void> write(String locale) =>
      _preferences.setString('maydon.locale', locale);
}

class MemoryLocaleStore implements LocaleStore {
  String? value;
  @override
  Future<String?> read() async => value;
  @override
  Future<void> write(String locale) async {
    value = locale;
  }
}
