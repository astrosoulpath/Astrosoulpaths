import 'dart:convert';

import 'package:dio/dio.dart';

import '../../../core/config/api_config.dart';
import '../../auth/data/auth_session_store.dart';

class ChatUploadException implements Exception {
  const ChatUploadException(this.message, {this.code});

  final String message;
  final String? code;

  @override
  String toString() => message;
}

class ChatUploadResult {
  const ChatUploadResult({
    required this.url,
    required this.path,
    required this.fileName,
    required this.mimeType,
    required this.size,
    required this.type,
  });

  factory ChatUploadResult.fromJson(Map<String, dynamic> json) {
    return ChatUploadResult(
      url: json['url']?.toString().trim() ?? '',
      path: json['path']?.toString().trim() ?? '',
      fileName: json['fileName']?.toString().trim() ?? '',
      mimeType: json['mimeType']?.toString().trim() ?? '',
      size: int.tryParse(json['size']?.toString() ?? '') ?? 0,
      type: json['type']?.toString().trim().toUpperCase() ?? '',
    );
  }

  final String url;
  final String path;
  final String fileName;
  final String mimeType;
  final int size;
  final String type;
}

class ChatUploadApi {
  ChatUploadApi({Dio? dio, AuthSessionStore? sessionStore})
    : _dio = dio ?? Dio(),
      _sessionStore = sessionStore ?? AuthSessionStore();

  final Dio _dio;
  final AuthSessionStore _sessionStore;

  Future<ChatUploadResult> uploadImage({
    required String callSessionId,
    required String filePath,
    String? caption,
    void Function(double progress)? onProgress,
  }) {
    return _upload(
      path: '/chat/upload/image',
      callSessionId: callSessionId,
      filePath: filePath,
      caption: caption,
      onProgress: onProgress,
    );
  }

  Future<ChatUploadResult> uploadFile({
    required String callSessionId,
    required String filePath,
    String? caption,
    void Function(double progress)? onProgress,
  }) {
    return _upload(
      path: '/chat/upload/file',
      callSessionId: callSessionId,
      filePath: filePath,
      caption: caption,
      onProgress: onProgress,
    );
  }

  Future<ChatUploadResult> uploadAudio({
    required String callSessionId,
    required String filePath,
    required int audioDurationMs,
    void Function(double progress)? onProgress,
  }) {
    if (audioDurationMs < 1 || audioDurationMs > 10 * 60 * 1000) {
      throw const ChatUploadException(
        'Voice note duration must be between 1 ms and 10 minutes.',
      );
    }

    return _upload(
      path: '/chat/upload/audio',
      callSessionId: callSessionId,
      filePath: filePath,
      extraFields: <String, dynamic>{'audioDurationMs': audioDurationMs},
      onProgress: onProgress,
    );
  }

  Future<ChatUploadResult> _upload({
    required String path,
    required String callSessionId,
    required String filePath,
    String? caption,
    Map<String, dynamic>? extraFields,
    void Function(double progress)? onProgress,
  }) async {
    final normalizedId = callSessionId.trim();
    final normalizedPath = filePath.trim();

    if (normalizedId.isEmpty) {
      throw const ChatUploadException('Consultation ID is required.');
    }

    if (normalizedPath.isEmpty) {
      throw const ChatUploadException('Attachment file is required.');
    }

    final session = await _sessionStore.read();
    final token = session?.accessToken.trim() ?? '';

    if (token.isEmpty) {
      throw const ChatUploadException(
        'Please login to upload attachments.',
        code: 'LOGIN_REQUIRED',
      );
    }

    try {
      onProgress?.call(0);

      final formData = FormData.fromMap({
        'callSessionId': normalizedId,
        ...?extraFields,
        if (caption?.trim().isNotEmpty == true) 'caption': caption!.trim(),
        'file': await MultipartFile.fromFile(normalizedPath),
      });

      final response = await _dio.post<dynamic>(
        '${ApiConfig.baseUrl}$path',
        data: formData,
        options: Options(
          headers: {
            'Accept': 'application/json',
            'Authorization': 'Bearer $token',
          },
          sendTimeout: ApiConfig.requestTimeout,
          receiveTimeout: ApiConfig.requestTimeout,
          validateStatus: (_) => true,
        ),
        onSendProgress: (sent, total) {
          if (total <= 0) {
            return;
          }

          final progress = (sent / total).clamp(0.0, 1.0);
          onProgress?.call(progress);
        },
      );

      final body = _decodeBody(response.data);
      final statusCode = response.statusCode ?? 0;

      if (statusCode >= 200 && statusCode < 300 && body['success'] == true) {
        final rawData = body['data'];

        if (rawData is! Map) {
          throw const ChatUploadException(
            'The server returned invalid upload data.',
          );
        }

        final result = ChatUploadResult.fromJson(
          Map<String, dynamic>.from(rawData),
        );

        if (result.url.isEmpty ||
            result.fileName.isEmpty ||
            result.mimeType.isEmpty ||
            result.size <= 0 ||
            (result.type != 'IMAGE' &&
                result.type != 'FILE' &&
                result.type != 'AUDIO')) {
          throw const ChatUploadException(
            'The server returned an invalid attachment.',
          );
        }

        onProgress?.call(1);

        return result;
      }

      final message = _readMessage(body, fallback: 'Attachment upload failed.');

      throw ChatUploadException(
        statusCode == 401
            ? 'Your session has expired. Please login again.'
            : message,
        code: statusCode == 401 ? 'LOGIN_REQUIRED' : 'UPLOAD_ERROR',
      );
    } on ChatUploadException {
      rethrow;
    } on DioException catch (error) {
      final body = _decodeBody(error.response?.data);
      final statusCode = error.response?.statusCode ?? 0;

      if (statusCode > 0) {
        throw ChatUploadException(
          statusCode == 401
              ? 'Your session has expired. Please login again.'
              : _readMessage(body, fallback: 'Attachment upload failed.'),
          code: statusCode == 401 ? 'LOGIN_REQUIRED' : 'UPLOAD_ERROR',
        );
      }

      throw const ChatUploadException(
        'Unable to upload attachment. Please try again.',
        code: 'CONNECTION_ERROR',
      );
    } catch (_) {
      throw const ChatUploadException(
        'Unable to upload attachment. Please try again.',
        code: 'CONNECTION_ERROR',
      );
    }
  }

  Map<String, dynamic> _decodeBody(dynamic source) {
    if (source is Map<String, dynamic>) {
      return source;
    }

    if (source is Map) {
      return Map<String, dynamic>.from(source);
    }

    if (source is! String || source.trim().isEmpty) {
      return <String, dynamic>{};
    }

    try {
      final decoded = jsonDecode(source);

      if (decoded is Map<String, dynamic>) {
        return decoded;
      }

      if (decoded is Map) {
        return Map<String, dynamic>.from(decoded);
      }
    } catch (_) {
      // Caller returns a consistent error.
    }

    return <String, dynamic>{};
  }

  String _readMessage(Map<String, dynamic> body, {required String fallback}) {
    final message = body['message'];

    if (message is String && message.trim().isNotEmpty) {
      return message.trim();
    }

    if (message is List && message.isNotEmpty) {
      return message.map((item) => item.toString()).join('\n');
    }

    return fallback;
  }

  void close() {
    _dio.close(force: true);
  }
}
