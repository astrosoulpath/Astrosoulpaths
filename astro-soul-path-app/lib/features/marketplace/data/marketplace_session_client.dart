import 'package:http/http.dart' as http;
import '../../auth/data/auth_session_store.dart';

/// Never retries writes or lets an old account's response reach a new session.
class MarketplaceSessionClient extends http.BaseClient {
  MarketplaceSessionClient(
    this.inner,
    this.sessions, {
    int Function()? revisionReader,
  }) : _revisionReader =
           revisionReader ?? (() => AuthSessionStore.sessionRevision) {
    _ownerRevision = _revisionReader();
  }
  final http.Client inner;
  final AuthSessionStore sessions;
  final int Function() _revisionReader;
  late final int _ownerRevision;

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    final revision = _revisionReader();
    if (revision != _ownerRevision) {
      throw http.ClientException(
        'Marketplace account changed. Reopen this screen.',
      );
    }
    final authorization = request.headers['Authorization'];
    if (authorization != null) {
      final current = await sessions.read();
      if (current == null ||
          revision != _revisionReader() ||
          authorization != 'Bearer ${current.accessToken.trim()}') {
        throw http.ClientException(
          'Marketplace session changed. Reopen this screen.',
        );
      }
    }
    final streamed = await inner.send(request);
    final response = await http.Response.fromStream(streamed);
    if (revision != _revisionReader()) {
      throw http.ClientException(
        'Marketplace session changed. Reopen this screen.',
      );
    }
    return http.StreamedResponse(
      Stream.value(response.bodyBytes),
      response.statusCode,
      headers: response.headers,
      request: request,
      reasonPhrase: response.reasonPhrase,
    );
  }

  @override
  void close() => inner.close();
}
