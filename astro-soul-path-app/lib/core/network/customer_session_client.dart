import 'package:http/http.dart' as http;

import '../../features/auth/data/auth_session_store.dart';
import '../config/api_config.dart';

/// A screen-owned transport. Never retries a write or publishes another
/// account's response, including a body that finishes streaming after logout.
class CustomerSessionClient extends http.BaseClient {
  CustomerSessionClient(this.inner, {int Function()? revisionReader})
    : _revisionReader =
          revisionReader ?? (() => AuthSessionStore.sessionRevision) {
    _owner = _revisionReader();
  }

  final http.Client inner;
  final int Function() _revisionReader;
  late final int _owner;

  void _checkOwner() {
    if (_owner != _revisionReader()) {
      throw http.ClientException('Account changed. Reopen this screen.');
    }
  }

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    _checkOwner();
    final response = await (() async {
      final streamed = await inner.send(request);
      return http.Response.fromStream(streamed);
    })().timeout(ApiConfig.requestTimeout);
    _checkOwner();
    return http.StreamedResponse(
      Stream.value(response.bodyBytes),
      response.statusCode,
      headers: response.headers,
      request: request,
      reasonPhrase: response.reasonPhrase,
      isRedirect: response.isRedirect,
      persistentConnection: response.persistentConnection,
    );
  }

  @override
  void close() => inner.close();
}
