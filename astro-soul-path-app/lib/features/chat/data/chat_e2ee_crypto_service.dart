import 'dart:convert';

import 'package:cryptography/cryptography.dart';

import 'chat_api.dart';
import 'chat_e2ee_identity_service.dart';

class ChatE2eeEncryptedPayload {
  const ChatE2eeEncryptedPayload({
    required this.encryptedContent,
    required this.nonce,
    required this.mac,
    required this.version,
  });

  final String encryptedContent;
  final String nonce;
  final String mac;
  final int version;
}

class ChatE2eeCryptoService {
  ChatE2eeCryptoService({
    ChatApi? chatApi,
    ChatE2eeIdentityService? identityService,
  }) : _chatApi = chatApi ?? ChatApi(),
       _identityService = identityService ?? ChatE2eeIdentityService();

  static const int encryptionVersion = 1;

  final ChatApi _chatApi;
  final ChatE2eeIdentityService _identityService;

  final X25519 _x25519 = X25519();

  final Hkdf _hkdf = Hkdf(hmac: Hmac.sha256(), outputLength: 32);

  final AesGcm _aes = AesGcm.with256bits();
  final Map<String, SecretKey> _consultationKeyCache = <String, SecretKey>{};

  Future<void> ensureIdentityRegistered() async {
    await _identityService.ensureRegistered();
  }

  Future<SecretKey> deriveConsultationKey(String callSessionId) async {
    final normalizedCallSessionId = callSessionId.trim();

    if (normalizedCallSessionId.isEmpty) {
      throw StateError('Call session ID is required for E2EE.');
    }

    final cachedKey = _consultationKeyCache[normalizedCallSessionId];

    if (cachedKey != null) {
      return cachedKey;
    }

    final identity = await _identityService.ensureRegistered();

    final participants = await _chatApi.getE2eeParticipants(
      normalizedCallSessionId,
    );

    final currentUserId = (participants['currentUserId'] ?? '')
        .toString()
        .trim();

    final customerUserId = (participants['customerUserId'] ?? '')
        .toString()
        .trim();

    final astrologerUserId = (participants['astrologerUserId'] ?? '')
        .toString()
        .trim();

    final rawDevices = participants['devices'];

    if (currentUserId.isEmpty ||
        customerUserId.isEmpty ||
        astrologerUserId.isEmpty ||
        rawDevices is! List) {
      throw StateError('Invalid E2EE participant information.');
    }

    final peerUserId = currentUserId == customerUserId
        ? astrologerUserId
        : customerUserId;

    Map<String, dynamic>? peerDevice;

    for (final item in rawDevices) {
      if (item is! Map) {
        continue;
      }

      final map = Map<String, dynamic>.from(item);

      if ((map['userId'] ?? '').toString() != peerUserId) {
        continue;
      }

      final publicKey = (map['publicKey'] ?? '').toString().trim();

      if (publicKey.isEmpty) {
        continue;
      }

      peerDevice = map;
      break;
    }

    if (peerDevice == null) {
      throw StateError(
        'The other participant has not enabled secure chat yet.',
      );
    }

    final peerPublicBytes = base64Decode(peerDevice['publicKey'].toString());

    if (peerPublicBytes.length != 32) {
      throw StateError('Invalid peer X25519 public key.');
    }

    final peerPublicKey = SimplePublicKey(
      peerPublicBytes,
      type: _x25519.keyPairType,
    );

    final sharedSecret = await _x25519.sharedSecretKey(
      keyPair: identity.keyPair,
      remotePublicKey: peerPublicKey,
    );

    final salt = utf8.encode('asp-chat-e2ee-v1:$normalizedCallSessionId');

    final derivedKey = await _hkdf.deriveKey(
      secretKey: sharedSecret,
      nonce: salt,
    );

    _consultationKeyCache[normalizedCallSessionId] = derivedKey;

    return derivedKey;
  }

  Future<ChatE2eeEncryptedPayload> encryptText({
    required String callSessionId,
    required String plaintext,
  }) async {
    final normalizedPlaintext = plaintext.trim();

    if (normalizedPlaintext.isEmpty) {
      throw StateError('Plaintext message cannot be empty.');
    }

    final secretKey = await deriveConsultationKey(callSessionId);

    final nonce = _aes.newNonce();

    final secretBox = await _aes.encrypt(
      utf8.encode(normalizedPlaintext),
      secretKey: secretKey,
      nonce: nonce,
    );

    return ChatE2eeEncryptedPayload(
      encryptedContent: base64Encode(secretBox.cipherText),
      nonce: base64Encode(secretBox.nonce),
      mac: base64Encode(secretBox.mac.bytes),
      version: encryptionVersion,
    );
  }

  Future<String> decryptText({
    required String callSessionId,
    required String encryptedContent,
    required String nonce,
    required String mac,
    required int version,
  }) async {
    if (version != encryptionVersion) {
      throw StateError('Unsupported chat encryption version.');
    }

    final cipherBytes = base64Decode(encryptedContent);

    final nonceBytes = base64Decode(nonce);

    final macBytes = base64Decode(mac);

    final secretKey = await deriveConsultationKey(callSessionId);

    final clearBytes = await _aes.decrypt(
      SecretBox(cipherBytes, nonce: nonceBytes, mac: Mac(macBytes)),
      secretKey: secretKey,
    );

    return utf8.decode(clearBytes);
  }
}
