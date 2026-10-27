import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:astro_soul_path/features/astrologer/data/astrologer_portal_api.dart';

void main() {
  for (final entry in {
    'pdf': 'application/pdf',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
  }.entries) {
    test(
      'KYC ${entry.key} upload sends explicit supported multipart content type',
      () async {
        final directory = await Directory.systemTemp.createTemp(
          'asp-kyc-synthetic-',
        );
        final file = File('${directory.path}/synthetic.${entry.key}');
        await file.writeAsBytes(utf8.encode('synthetic fixture only'));
        addTearDown(() async {
          await file.delete();
          await directory.delete();
        });
        var requests = 0;
        final api = AstrologerPortalApi(
          client: MockClient((request) async {
            requests++;
            expect(request.url.path, '/astrologer/kyc/upload');
            expect(request.headers['authorization'], 'Bearer synthetic');
            final multipart = utf8.decode(
              request.bodyBytes,
              allowMalformed: true,
            );
            expect(multipart, contains('content-type: ${entry.value}'));
            expect(multipart, contains('name="documentType"'));
            expect(multipart, contains('identity'));
            return http.Response(
              '{"success":true,"data":{"path":"owner/identity/synthetic.${entry.key}"}}',
              200,
            );
          }),
        );
        addTearDown(api.close);
        expect(
          (await api.uploadKycDocument(
            accessToken: 'synthetic',
            filePath: file.path,
            documentType: 'identity',
          ))['success'],
          true,
        );
        expect(requests, 1);
      },
    );
  }
  test(
    'unsupported KYC extension fails before a request or file read',
    () async {
      var requests = 0;
      final api = AstrologerPortalApi(
        client: MockClient((_) async {
          requests++;
          return http.Response('{}', 500);
        }),
      );
      addTearDown(api.close);
      await expectLater(
        api.uploadKycDocument(
          accessToken: 'synthetic',
          filePath: 'synthetic.exe',
          documentType: 'identity',
        ),
        throwsA(isA<AstrologerPortalApiException>()),
      );
      expect(requests, 0);
    },
  );
  test('missing authentication cannot upload any document', () async {
    var requests = 0;
    final api = AstrologerPortalApi(
      client: MockClient((_) async {
        requests++;
        return http.Response('{}', 500);
      }),
    );
    addTearDown(api.close);
    await expectLater(
      api.uploadKycDocument(
        accessToken: '',
        filePath: 'synthetic.pdf',
        documentType: 'identity',
      ),
      throwsA(isA<AstrologerPortalApiException>()),
    );
    expect(requests, 0);
  });
}
