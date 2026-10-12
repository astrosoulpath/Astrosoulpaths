import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:astro_soul_path/features/astrologer/data/astrologer_portal_api.dart';
import 'package:astro_soul_path/features/astrologer/presentation/screens/astrologer_registration_screen.dart';

Map<String, dynamic> upload(String type, {String? path}) => {
  'success': true,
  'data': {
    'documentType': type,
    'fileName': '$type.pdf',
    'path': path ?? 'canonical-user/$type/server-object.pdf',
  },
};
void main() {
  for (final type in ['identity', 'certificate', 'experience']) {
    test('maps successful $type upload using server metadata', () {
      expect(kycDocumentFromUpload(upload(type), type), {
        'type': type,
        'name': '$type.pdf',
        'url': 'canonical-user/$type/server-object.pdf',
      });
    });
  }
  for (final path in [
    r'C:\device\identity.pdf',
    '/data/user/identity.pdf',
    'file:///device/identity.pdf',
    'https://example.invalid/identity.pdf',
    '../identity/file.pdf',
    'user/identity/..',
    'user/certificate/file.pdf',
    '',
  ]) {
    test('rejects invalid or local storage reference: $path', () {
      expect(
        () => kycDocumentFromUpload(upload('identity', path: path), 'identity'),
        throwsA(isA<AstrologerPortalApiException>()),
      );
    });
  }
  test('rejects failed, missing, mismatched and malformed metadata', () {
    for (final response in <Map<String, dynamic>>[
      {'success': false, 'data': upload('identity')['data']},
      {'success': true},
      upload('certificate'),
      {
        'success': true,
        'data': {
          'documentType': 'identity',
          'path': 'user/identity/file.pdf',
          'fileName': '',
        },
      },
      {
        'success': true,
        'data': {
          'documentType': 'identity',
          'path': 123,
          'fileName': 'proof.pdf',
        },
      },
    ]) {
      expect(
        () => kycDocumentFromUpload(response, 'identity'),
        throwsA(isA<AstrologerPortalApiException>()),
      );
    }
  });
  test(
    'registration serializes server metadata for all document categories',
    () async {
      final documents = {
        'identityProof': kycDocumentFromUpload(upload('identity'), 'identity'),
        'certificates': [
          kycDocumentFromUpload(upload('certificate'), 'certificate'),
        ],
        'experienceProofs': [
          kycDocumentFromUpload(upload('experience'), 'experience'),
        ],
      };
      final api = AstrologerPortalApi(
        client: MockClient((request) async {
          expect(request.url.path, '/astrologer/register');
          final body = jsonDecode(request.body) as Map<String, dynamic>;
          expect(body['documents'], documents);
          expect(body['phoneNumber'], '+919876543210');
          expect(body['email'], 'owner@example.invalid');
          return http.Response('{"success":true}', 200);
        }),
      );
      addTearDown(api.close);
      await api.register(
        accessToken: 'mock-token',
        fullName: 'Applicant',
        email: 'owner@example.invalid',
        phoneNumber: '+919876543210',
        languages: ['English'],
        expertise: ['Vedic'],
        experienceYears: 1,
        consultationPrice: 10,
        documents: documents,
      );
    },
  );
}
