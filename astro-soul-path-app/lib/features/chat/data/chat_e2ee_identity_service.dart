import 'dart:convert';
import 'dart:math';

import 'package:cryptography/cryptography.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../auth/data/auth_session_store.dart';
import 'chat_api.dart';

class ChatE2eeIdentity {
  const ChatE2eeIdentity({
    required this.deviceId,
    required this.publicKeyBase64,
    required this.keyPair,
  });

  final String deviceId;
  final String publicKeyBase64;
  final SimpleKeyPairData keyPair;
}

class ChatE2eeIdentityService {
  ChatE2eeIdentityService({
    FlutterSecureStorage? storage,
    ChatApi? chatApi,
    AuthSessionStore? sessionStore,
  }) : _storage = storage ?? const FlutterSecureStorage(),
       _chatApi = chatApi ?? ChatApi(),
       _sessionStore = sessionStore ?? AuthSessionStore();

  static const _deviceIdKey = 'asp_chat_e2ee_device_id_v1';
  static const _privateKeyKey = 'asp_chat_e2ee_private_key_v1';
  static const _publicKeyKey = 'asp_chat_e2ee_public_key_v1';

  final FlutterSecureStorage _storage;
  final ChatApi _chatApi;
  final AuthSessionStore _sessionStore;
  final X25519 _x25519 = X25519();

  Future<ChatE2eeIdentity> ensureRegistered() async {
    final session = await _sessionStore.read();

    if (session == null) {
      throw StateError('Authenticated session is required for secure chat.');
    }

    final user = session.user;
    final userId =
        user['id']?.toString().trim() ??
        user['userId']?.toString().trim() ??
        '';

    final phone = user['phone']?.toString().trim() ?? '';

    if (kDebugMode) {
      debugPrint(
        '[E2EE] register start '
        'userId=$userId '
        'phone=$phone '
        'role=${session.role} '
        'portal=${session.portal}',
      );
    }

    final identity = await loadOrCreateIdentity();

    if (kDebugMode) {
      debugPrint(
        '[E2EE] local identity '
        'deviceId=${identity.deviceId} '
        'userId=$userId',
      );
    }

    try {
      await _chatApi.registerE2eeDevice(
        deviceId: identity.deviceId,
        publicKey: identity.publicKeyBase64,
        keyVersion: 1,
      );
    } catch (error, stackTrace) {
      if (kDebugMode) {
        debugPrint(
          '[E2EE] registration FAILED '
          'userId=$userId '
          'role=${session.role} '
          'portal=${session.portal} '
          'error=$error',
        );
        debugPrintStack(stackTrace: stackTrace);
      }

      rethrow;
    }

    if (kDebugMode) {
      debugPrint(
        '[E2EE] registration SUCCESS '
        'userId=$userId '
        'deviceId=${identity.deviceId}',
      );
    }

    return identity;
  }

  Future<ChatE2eeIdentity> loadOrCreateIdentity() async {
    final storageKeys = await _currentStorageKeys();

    var storedDeviceId =
        (await _storage.read(key: storageKeys.deviceIdKey))?.trim() ?? '';

    var storedPrivateKey =
        (await _storage.read(key: storageKeys.privateKeyKey))?.trim() ?? '';

    var storedPublicKey =
        (await _storage.read(key: storageKeys.publicKeyKey))?.trim() ?? '';

    // One-time migration for the currently authenticated account.
    //
    // Older builds stored one E2EE identity globally. If this account does
    // not yet have account-bound keys, preserve that existing identity
    // instead of rotating it and making previous secure messages unreadable.
    if (storedDeviceId.isEmpty &&
        storedPrivateKey.isEmpty &&
        storedPublicKey.isEmpty) {
      final legacyDeviceId =
          (await _storage.read(key: _deviceIdKey))?.trim() ?? '';
      final legacyPrivateKey =
          (await _storage.read(key: _privateKeyKey))?.trim() ?? '';
      final legacyPublicKey =
          (await _storage.read(key: _publicKeyKey))?.trim() ?? '';

      if (legacyDeviceId.isNotEmpty &&
          legacyPrivateKey.isNotEmpty &&
          legacyPublicKey.isNotEmpty) {
        await Future.wait([
          _storage.write(key: storageKeys.deviceIdKey, value: legacyDeviceId),
          _storage.write(
            key: storageKeys.privateKeyKey,
            value: legacyPrivateKey,
          ),
          _storage.write(key: storageKeys.publicKeyKey, value: legacyPublicKey),
        ]);

        storedDeviceId = legacyDeviceId;
        storedPrivateKey = legacyPrivateKey;
        storedPublicKey = legacyPublicKey;
      }
    }

    if (storedDeviceId.isNotEmpty &&
        storedPrivateKey.isNotEmpty &&
        storedPublicKey.isNotEmpty) {
      try {
        final privateBytes = base64Decode(storedPrivateKey);
        final publicBytes = base64Decode(storedPublicKey);

        if (privateBytes.length == 32 && publicBytes.length == 32) {
          final publicKey = SimplePublicKey(
            publicBytes,
            type: _x25519.keyPairType,
          );

          final keyPair = SimpleKeyPairData(
            privateBytes,
            publicKey: publicKey,
            type: _x25519.keyPairType,
          );

          return ChatE2eeIdentity(
            deviceId: storedDeviceId,
            publicKeyBase64: base64Encode(publicBytes),
            keyPair: keyPair,
          );
        }
      } catch (_) {
        // Invalid local identity is rotated below.
      }
    }

    return _createIdentity();
  }

  Future<ChatE2eeIdentity> _createIdentity() async {
    final generatedKeyPair = await _x25519.newKeyPair();
    final extractedKeyPair = await generatedKeyPair.extract();

    final publicKey = await extractedKeyPair.extractPublicKey();

    final privateBytes = await extractedKeyPair.extractPrivateKeyBytes();

    final publicBytes = publicKey.bytes;

    if (privateBytes.length != 32 || publicBytes.length != 32) {
      throw StateError('Invalid X25519 encryption identity.');
    }

    final deviceId = _createDeviceId();

    final storageKeys = await _currentStorageKeys();

    await Future.wait([
      _storage.write(key: storageKeys.deviceIdKey, value: deviceId),
      _storage.write(
        key: storageKeys.privateKeyKey,
        value: base64Encode(privateBytes),
      ),
      _storage.write(
        key: storageKeys.publicKeyKey,
        value: base64Encode(publicBytes),
      ),
    ]);

    return ChatE2eeIdentity(
      deviceId: deviceId,
      publicKeyBase64: base64Encode(publicBytes),
      keyPair: SimpleKeyPairData(
        List<int>.from(privateBytes),
        publicKey: SimplePublicKey(
          List<int>.from(publicBytes),
          type: _x25519.keyPairType,
        ),
        type: _x25519.keyPairType,
      ),
    );
  }

  Future<_ChatE2eeStorageKeys> _currentStorageKeys() async {
    final session = await _sessionStore.read();

    if (session == null) {
      throw StateError('Authenticated session is required for secure chat.');
    }

    final user = session.user;

    final rawUserId =
        [
              user['id'],
              user['userId'],
              user['supabaseId'],
              user['phone'],
              user['email'],
            ]
            .map((value) => value?.toString().trim() ?? '')
            .firstWhere((value) => value.isNotEmpty, orElse: () => '');

    if (rawUserId.isEmpty) {
      throw StateError(
        'Authenticated user identity is required for secure chat.',
      );
    }

    final namespace = base64UrlEncode(
      utf8.encode(rawUserId),
    ).replaceAll('=', '');

    return _ChatE2eeStorageKeys(
      deviceIdKey: '${_deviceIdKey}_$namespace',
      privateKeyKey: '${_privateKeyKey}_$namespace',
      publicKeyKey: '${_publicKeyKey}_$namespace',
    );
  }

  String _createDeviceId() {
    final random = Random.secure();
    final bytes = List<int>.generate(
      18,
      (_) => random.nextInt(256),
      growable: false,
    );

    return base64UrlEncode(bytes).replaceAll('=', '');
  }
}

class _ChatE2eeStorageKeys {
  const _ChatE2eeStorageKeys({
    required this.deviceIdKey,
    required this.privateKeyKey,
    required this.publicKeyKey,
  });

  final String deviceIdKey;
  final String privateKeyKey;
  final String publicKeyKey;
}
