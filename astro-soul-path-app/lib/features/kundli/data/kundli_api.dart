import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;

import '../../../core/config/api_config.dart';
import '../../auth/data/auth_session_store.dart';
import '../../profile/data/customer_profile.dart';

class KundliApiException implements Exception {
  const KundliApiException(
    this.message, {
    this.loginRequired = false,
    this.subscriptionRequired = false,
  });

  final String message;
  final bool loginRequired;
  final bool subscriptionRequired;

  @override
  String toString() => message;
}

class KundliReport {
  const KundliReport({
    required this.raw,
    required this.provider,
    required this.status,
    required this.coreCompletenessPercent,
    this.chartStyle = 'NORTH_INDIAN',
    this.monthType = 'AMANT',
    this.darkMode = false,
    this.hideOuterPlanets = false,
    this.customCalendar = false,
  });

  final Map<String, dynamic> raw;
  final String provider;
  final String status;
  final int coreCompletenessPercent;

  final String chartStyle;
  final String monthType;
  final bool darkMode;
  final bool hideOuterPlanets;
  final bool customCalendar;
  bool get isComplete => status.toUpperCase() == 'COMPLETE';

  bool get isPartial => status.toUpperCase() == 'PARTIAL';

  Map<String, dynamic>? get birthChart => _asMap(raw['birthChart']);

  Map<String, dynamic>? get navamsaChart => _asMap(raw['navamsaChart']);

  Map<String, dynamic>? get charts => _asMap(raw['charts']);

  Map<String, dynamic>? get divisionalCharts =>
      _asMap(charts?['divisionalCharts']);

  Map<String, dynamic>? divisionalChart(String division) =>
      _asMap(divisionalCharts?[division]);

  Map<String, dynamic>? get horaChart => divisionalChart('D2');

  Map<String, dynamic>? get drekkanaChart => divisionalChart('D3');

  Map<String, dynamic>? get saptamsaChart => divisionalChart('D7');

  Map<String, dynamic>? get dasamsaChart => divisionalChart('D10');

  Map<String, dynamic>? get dwadasamsaChart => divisionalChart('D12');

  Map<String, dynamic>? get shashtiamsaChart => divisionalChart('D60');
  static const List<String> professionalAdvancedVargas = <String>[
    'D2',
    'D3',
    'D7',
    'D10',
    'D12',
    'D60',
  ];

  List<String> get availableAdvancedVargas {
    return professionalAdvancedVargas
        .where((division) {
          final chart = divisionalChart(division);

          if (chart == null) {
            return false;
          }

          return chart.isNotEmpty;
        })
        .toList(growable: false);
  }

  List<String> get missingAdvancedVargas {
    return professionalAdvancedVargas
        .where((division) {
          final chart = divisionalChart(division);

          if (chart == null) {
            return true;
          }

          return chart.isEmpty;
        })
        .toList(growable: false);
  }

  bool get hasAnyAdvancedVarga => availableAdvancedVargas.isNotEmpty;

  bool get hasAllAdvancedVargas => missingAdvancedVargas.isEmpty;

  int get advancedVargaAvailableCount => availableAdvancedVargas.length;

  String get advancedVargaCoverageLabel =>
      '$advancedVargaAvailableCount/${professionalAdvancedVargas.length}';

  dynamic get planetaryPositions => raw['planetaryPositions'];

  Map<String, dynamic>? get dasha => _asMap(raw['dasha']);

  dynamic get panchang => raw['panchang'];

  dynamic get yogas => raw['yogas'];

  dynamic get shadbala => raw['shadbala'];

  dynamic get ashtakavarga => raw['ashtakavarga'];

  Map<String, dynamic>? get analysis => _asMap(raw['analysis']);

  String? get d1Explanation {
    final value = analysis?['d1Explanation'] ?? raw['d1Explanation'];

    final text = value?.toString().trim() ?? '';

    return text.isEmpty ? null : text;
  }

  String? get d9Explanation {
    final value = analysis?['d9Explanation'] ?? raw['d9Explanation'];

    final text = value?.toString().trim() ?? '';

    return text.isEmpty ? null : text;
  }

  dynamic get career => analysis?['career'];

  dynamic get marriage => analysis?['marriage'];

  dynamic get finance => analysis?['finance'];

  dynamic get health => analysis?['health'];

  dynamic get transit => analysis?['transit'];

  dynamic get houseAnalysis =>
      analysis?['houses'] ?? raw['houses'] ?? kp?['houses'];

  dynamic get gemSuggestion =>
      extended?['gemSuggestion'] ?? raw['gemSuggestion'];

  dynamic get sadeSati => extended?['sadeSati'] ?? raw['sadeSati'];

  dynamic get character =>
      analysis?['character'] ??
      raw['character'] ??
      raw['predictions']?['character'];

  dynamic get remedies =>
      raw['remedies'] ??
      raw['analysis']?['remedies'] ??
      extended?['gemSuggestion'];

  Map<String, dynamic>? get dosha => _asMap(raw['dosha']);

  Map<String, dynamic>? get extended => _asMap(raw['extended']);

  Map<String, dynamic>? get kp => _asMap(raw['kp']);

  static Map<String, dynamic>? _asMap(dynamic value) {
    if (value is Map<String, dynamic>) {
      return value;
    }

    if (value is Map) {
      return Map<String, dynamic>.from(value);
    }

    return null;
  }
}

class KundliGenerationResult {
  const KundliGenerationResult({
    required this.report,
    required this.savedRecordId,
  });

  final KundliReport report;
  final String savedRecordId;
}

Map<String, dynamic>? _savedMap(Object? value) {
  if (value is Map<String, dynamic>) {
    return value;
  }

  if (value is Map) {
    return Map<String, dynamic>.from(value);
  }

  return null;
}

class ProfessionalSavedKundli {
  const ProfessionalSavedKundli({
    required this.id,
    required this.kundliId,
    required this.name,
    required this.gender,
    required this.birthPlace,
    required this.language,
    required this.createdAt,
    required this.updatedAt,
    required this.dob,
    required this.tob,
    required this.latitude,
    required this.longitude,
    required this.timezone,
    this.customerUserId,
  });

  final String id;
  final String kundliId;
  final String? customerUserId;

  final String name;
  final String gender;
  final String birthPlace;
  final String language;

  final DateTime? createdAt;
  final DateTime? updatedAt;

  final String dob;
  final String tob;

  final double latitude;
  final double longitude;
  final double timezone;

  factory ProfessionalSavedKundli.fromJson(Map<String, dynamic> json) {
    final kundli = _savedMap(json['kundli']) ?? const <String, dynamic>{};

    return ProfessionalSavedKundli(
      id: json['id']?.toString().trim() ?? '',
      kundliId: json['kundliId']?.toString().trim() ?? '',
      customerUserId:
          json['customerUserId']?.toString().trim().isNotEmpty == true
          ? json['customerUserId'].toString().trim()
          : null,
      name: json['name']?.toString().trim() ?? '',
      gender: json['gender']?.toString().trim() ?? 'OTHER',
      birthPlace: json['birthPlace']?.toString().trim() ?? '',
      language: json['lang']?.toString().trim() ?? 'en',
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? ''),
      updatedAt: DateTime.tryParse(json['updatedAt']?.toString() ?? ''),
      dob: kundli['dob']?.toString().trim() ?? '',
      tob: kundli['tob']?.toString().trim() ?? '',
      latitude: _savedDouble(kundli['latitude']),
      longitude: _savedDouble(kundli['longitude']),
      timezone: _savedDouble(kundli['timezone']),
    );
  }
}

class ProfessionalSavedKundliDetail {
  const ProfessionalSavedKundliDetail({
    required this.record,
    required this.report,
    required this.reportUpdatedAt,
  });

  final ProfessionalSavedKundli record;
  final KundliReport report;
  final DateTime? reportUpdatedAt;

  factory ProfessionalSavedKundliDetail.fromJson(Map<String, dynamic> json) {
    final reportRaw = _savedMap(json['report']);

    if (reportRaw == null) {
      throw const KundliApiException('Saved Kundli report data is missing.');
    }

    final provider = reportRaw['provider']?.toString().trim() ?? '';

    final status = reportRaw['status']?.toString().trim() ?? 'UNKNOWN';

    final completeness = _savedMap(reportRaw['completeness']);

    final value = completeness?['corePercent'] ?? completeness?['core'] ?? 0;

    final percent = value is num
        ? value.round()
        : int.tryParse(value.toString()) ?? 0;

    return ProfessionalSavedKundliDetail(
      record: ProfessionalSavedKundli.fromJson(json),
      report: KundliReport(
        raw: reportRaw,
        provider: provider,
        status: status,
        coreCompletenessPercent: percent,
      ),
      reportUpdatedAt: DateTime.tryParse(
        json['reportUpdatedAt']?.toString() ?? '',
      ),
    );
  }
}

double _savedDouble(Object? value) {
  if (value is num) {
    return value.toDouble();
  }

  return double.tryParse(value?.toString() ?? '') ?? 0;
}

class KundliApi {
  KundliApi({http.Client? client, AuthSessionStore? sessionStore})
    : _client = client ?? http.Client(),
      _sessionStore = sessionStore ?? AuthSessionStore();

  final http.Client _client;
  final AuthSessionStore _sessionStore;

  Future<KundliReport> getProfileKundli({
    required String profileId,
    String language = 'en',
  }) async {
    final id = profileId.trim();
    final lang = language.trim().isEmpty ? 'en' : language.trim();

    if (id.isEmpty) {
      throw const KundliApiException(
        'Profile ID is required to generate Kundli.',
      );
    }

    final session = await _sessionStore.read();
    final accessToken = session?.accessToken.trim() ?? '';

    if (accessToken.isEmpty) {
      throw const KundliApiException(
        'Please login to continue.',
        loginRequired: true,
      );
    }

    try {
      final uri = Uri.parse(
        '${ApiConfig.baseUrl}/profile/$id/astro',
      ).replace(queryParameters: {'lang': lang});

      final response = await _client
          .get(
            uri,
            headers: {
              'Accept': 'application/json',
              'Authorization': 'Bearer $accessToken',
            },
          )
          .timeout(ApiConfig.requestTimeout);

      final body = _decodeBody(response.body);

      if (response.statusCode == 401) {
        throw const KundliApiException(
          'Your session has expired. Please login again.',
          loginRequired: true,
        );
      }

      if (response.statusCode == 402) {
        throw const KundliApiException(
          'Kundli service subscription is currently unavailable.',
          subscriptionRequired: true,
        );
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw KundliApiException(
          _readMessage(body, fallback: 'Unable to load your Kundli.'),
        );
      }

      if (body['success'] != true) {
        throw KundliApiException(
          _readMessage(body, fallback: 'Unable to load your Kundli.'),
        );
      }

      final outerData = _asMap(body['data']);

      if (outerData == null) {
        throw const KundliApiException(
          'The server returned an invalid Kundli response.',
        );
      }

      final report = _extractReport(outerData);

      if (report == null) {
        throw const KundliApiException(
          'The server returned an invalid Kundli report.',
        );
      }

      final provider = report['provider']?.toString().trim() ?? '';
      final status = report['status']?.toString().trim() ?? 'UNKNOWN';

      final completeness = _asMap(report['completeness']);

      final percentValue =
          completeness?['corePercent'] ?? completeness?['core'] ?? 0;

      final corePercent = percentValue is num
          ? percentValue.round()
          : int.tryParse(percentValue.toString()) ?? 0;

      return KundliReport(
        raw: report,
        provider: provider,
        status: status,
        coreCompletenessPercent: corePercent,
      );
    } on KundliApiException {
      rethrow;
    } catch (_) {
      throw const KundliApiException(
        'Unable to connect to the Kundli service. Please try again.',
      );
    }
  }

  Future<Uint8List> downloadProfileKundliPdf({
    required String profileId,
    String language = 'en',
  }) async {
    final id = profileId.trim();
    final lang = language.trim().isEmpty ? 'en' : language.trim();

    if (id.isEmpty) {
      throw const KundliApiException(
        'Profile ID is required to download Kundli PDF.',
      );
    }

    final session = await _sessionStore.read();
    final accessToken = session?.accessToken.trim() ?? '';

    if (accessToken.isEmpty) {
      throw const KundliApiException(
        'Please login to continue.',
        loginRequired: true,
      );
    }

    try {
      final uri = Uri.parse(
        '${ApiConfig.baseUrl}/profile/$id/astro/pdf',
      ).replace(queryParameters: {'lang': lang});

      final response = await _client
          .get(
            uri,
            headers: {
              'Accept': 'application/pdf',
              'Authorization': 'Bearer $accessToken',
            },
          )
          .timeout(ApiConfig.requestTimeout);

      if (response.statusCode == 401) {
        throw const KundliApiException(
          'Your session has expired. Please login again.',
          loginRequired: true,
        );
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        final body = _decodeBody(response.body);

        throw KundliApiException(
          _readMessage(body, fallback: 'Unable to download Kundli PDF.'),
        );
      }

      final contentType = response.headers['content-type'] ?? '';

      if (!contentType.toLowerCase().contains('application/pdf')) {
        throw const KundliApiException(
          'The server returned an invalid Kundli PDF response.',
        );
      }

      final bytes = response.bodyBytes;

      if (bytes.isEmpty) {
        throw const KundliApiException('The generated Kundli PDF is empty.');
      }

      return Uint8List.fromList(bytes);
    } on KundliApiException {
      rethrow;
    } catch (_) {
      throw const KundliApiException(
        'Unable to connect to the Kundli PDF service. Please try again.',
      );
    }
  }

  Future<KundliReport> generateMyKundli() async {
    final session = await _sessionStore.read();
    final accessToken = session?.accessToken.trim() ?? '';

    if (accessToken.isEmpty) {
      throw const KundliApiException(
        'Please login to continue.',
        loginRequired: true,
      );
    }

    try {
      final response = await _client
          .get(
            Uri.parse('${ApiConfig.baseUrl}/kundli/my-kundli'),
            headers: {
              'Accept': 'application/json',
              'Authorization': 'Bearer $accessToken',
            },
          )
          .timeout(const Duration(seconds: 180));

      final body = _decodeBody(response.body);

      if (response.statusCode == 401) {
        throw const KundliApiException(
          'Your session has expired. Please login again.',
          loginRequired: true,
        );
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw KundliApiException(
          _readMessage(body, fallback: 'Unable to generate your Kundli.'),
        );
      }

      if (body['success'] != true) {
        throw KundliApiException(
          _readMessage(body, fallback: 'Unable to generate your Kundli.'),
        );
      }

      final data = _asMap(body['data']);

      if (data == null) {
        throw const KundliApiException(
          'The server returned an invalid Kundli response.',
        );
      }

      final report = _asMap(data['report']);
      final preferences = _asMap(data['preferences']);

      if (report == null) {
        throw const KundliApiException(
          'The server returned an invalid Kundli report.',
        );
      }

      final provider = report['provider']?.toString().trim() ?? '';
      final status = report['status']?.toString().trim() ?? 'UNKNOWN';

      final completeness = _asMap(report['completeness']);
      final percentValue =
          completeness?['corePercent'] ?? completeness?['core'] ?? 0;

      final percent = percentValue is num
          ? percentValue.toInt()
          : int.tryParse(percentValue.toString()) ?? 0;

      return KundliReport(
        raw: report,
        provider: provider,
        status: status,
        coreCompletenessPercent: percent,
        chartStyle:
            preferences?['chartStyle']?.toString().trim().toUpperCase() ??
            'NORTH_INDIAN',
        monthType:
            preferences?['monthType']?.toString().trim().toUpperCase() ??
            'AMANT',
        darkMode: preferences?['darkMode'] == true,
        hideOuterPlanets: preferences?['hideOuterPlanets'] == true,
        customCalendar: preferences?['customCalendar'] == true,
      );
    } on KundliApiException {
      rethrow;
    } catch (_) {
      throw const KundliApiException('Unable to connect to Kundli service.');
    }
  }

  Future<KundliGenerationResult> generateRealKundli({
    required CustomerProfile profile,
  }) async {
    final session = await _sessionStore.read();
    final accessToken = session?.accessToken.trim() ?? '';

    if (accessToken.isEmpty) {
      throw const KundliApiException(
        'Please login to continue.',
        loginRequired: true,
      );
    }

    final fullName = (profile.fullName?.trim().isNotEmpty ?? false)
        ? profile.fullName!.trim()
        : profile.name.trim();

    final birthPlace = [profile.city, profile.state, profile.country]
        .whereType<String>()
        .map((value) => value.trim())
        .where((value) => value.isNotEmpty)
        .join(', ');

    if (birthPlace.isEmpty) {
      throw const KundliApiException(
        'Please complete your birth place before generating Kundli.',
      );
    }

    final dob =
        '${profile.birthDate.year.toString().padLeft(4, '0')}-'
        '${profile.birthDate.month.toString().padLeft(2, '0')}-'
        '${profile.birthDate.day.toString().padLeft(2, '0')}';

    final tob = profile.birthTime.trim();

    if (tob.isEmpty) {
      throw const KundliApiException(
        'Please complete your birth time before generating Kundli.',
      );
    }

    try {
      final response = await _client
          .post(
            Uri.parse('${ApiConfig.baseUrl}/kundli/generate'),
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'Authorization': 'Bearer $accessToken',
            },
            body: jsonEncode({
              'name': fullName,
              'gender': profile.gender.trim().toUpperCase(),
              'birthPlace': birthPlace,
              'dob': dob,
              'tob': tob,
              'lat': profile.latitude,
              'lon': profile.longitude,
              'timezone': profile.timezone,
              'lang': profile.language?.trim().isNotEmpty == true
                  ? profile.language!.trim()
                  : 'en',
            }),
          )
          .timeout(const Duration(seconds: 180));

      final body = _decodeBody(response.body);

      if (response.statusCode == 401) {
        throw const KundliApiException(
          'Your session has expired. Please login again.',
          loginRequired: true,
        );
      }

      if (response.statusCode == 402 || response.statusCode == 403) {
        throw KundliApiException(
          _readMessage(
            body,
            fallback: 'An active Kundli subscription is required.',
          ),
          subscriptionRequired: true,
        );
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw KundliApiException(
          _readMessage(body, fallback: 'Unable to generate your Kundli.'),
        );
      }

      if (body['success'] != true) {
        throw KundliApiException(
          _readMessage(body, fallback: 'Unable to generate your Kundli.'),
        );
      }

      final data = _asMap(body['data']);

      if (data == null) {
        throw const KundliApiException(
          'The server returned an invalid Kundli response.',
        );
      }

      final report = _asMap(data['report']);

      if (report == null) {
        throw const KundliApiException(
          'The server returned an invalid Kundli report.',
        );
      }

      final savedRecordId = data['savedRecordId']?.toString().trim() ?? '';

      if (savedRecordId.isEmpty) {
        throw const KundliApiException(
          'Generated Kundli record ID is missing.',
        );
      }

      final provider = report['provider']?.toString().trim() ?? '';
      final status = report['status']?.toString().trim() ?? 'UNKNOWN';

      final completeness = _asMap(report['completeness']);

      final percentValue =
          completeness?['corePercent'] ?? completeness?['core'] ?? 0;

      final corePercent = percentValue is num
          ? percentValue.round()
          : int.tryParse(percentValue.toString()) ?? 0;

      return KundliGenerationResult(
        savedRecordId: savedRecordId,
        report: KundliReport(
          raw: report,
          provider: provider,
          status: status,
          coreCompletenessPercent: corePercent,
        ),
      );
    } on KundliApiException {
      rethrow;
    } catch (_) {
      throw const KundliApiException(
        'Unable to connect to the Kundli service. Please try again.',
      );
    }
  }

  Future<KundliGenerationResult> generateProfessionalKundli({
    required String name,
    required String gender,
    required String birthPlace,
    required String dob,
    required String tob,
    required double latitude,
    required double longitude,
    required double timezone,
    String language = 'en',
  }) async {
    final session = await _sessionStore.read();
    final accessToken = session?.accessToken.trim() ?? '';

    if (accessToken.isEmpty) {
      throw const KundliApiException(
        'Please login to continue.',
        loginRequired: true,
      );
    }

    final normalizedName = name.trim();
    final normalizedGender = gender.trim().toUpperCase();
    final normalizedBirthPlace = birthPlace.trim();
    final normalizedDob = dob.trim();
    final normalizedTob = tob.trim();
    final normalizedLanguage = language.trim().toLowerCase();

    if (normalizedName.isEmpty) {
      throw const KundliApiException('Client name is required.');
    }

    if (!const ['MALE', 'FEMALE', 'OTHER'].contains(normalizedGender)) {
      throw const KundliApiException('Please select a valid gender.');
    }

    if (normalizedBirthPlace.isEmpty) {
      throw const KundliApiException('Please select a valid birth place.');
    }

    final dobPattern = RegExp(r'^\d{4}-\d{2}-\d{2}$');
    final tobPattern = RegExp(r'^([01]\d|2[0-3]):([0-5]\d)$');

    if (!dobPattern.hasMatch(normalizedDob)) {
      throw const KundliApiException(
        'Date of birth must use YYYY-MM-DD format.',
      );
    }

    if (!tobPattern.hasMatch(normalizedTob)) {
      throw const KundliApiException('Time of birth must use HH:mm format.');
    }

    if (latitude < -90 || latitude > 90) {
      throw const KundliApiException('Invalid birth-place latitude.');
    }

    if (longitude < -180 || longitude > 180) {
      throw const KundliApiException('Invalid birth-place longitude.');
    }

    if (timezone < -12 || timezone > 14) {
      throw const KundliApiException('Invalid birth-place timezone.');
    }

    if (!const ['en', 'hi'].contains(normalizedLanguage)) {
      throw const KundliApiException('Unsupported Kundli language.');
    }

    try {
      final response = await _client
          .post(
            Uri.parse('${ApiConfig.baseUrl}/kundli/generate'),
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'Authorization': 'Bearer $accessToken',
            },
            body: jsonEncode({
              'name': normalizedName,
              'gender': normalizedGender,
              'birthPlace': normalizedBirthPlace,
              'dob': normalizedDob,
              'tob': normalizedTob,
              'lat': latitude,
              'lon': longitude,
              'timezone': timezone,
              'lang': normalizedLanguage,
            }),
          )
          .timeout(const Duration(seconds: 180));

      final body = _decodeBody(response.body);

      if (response.statusCode == 401) {
        throw const KundliApiException(
          'Your session has expired. Please login again.',
          loginRequired: true,
        );
      }

      if (response.statusCode == 402 || response.statusCode == 403) {
        final code = body['code']?.toString().trim() ?? '';

        throw KundliApiException(
          _readMessage(
            body,
            fallback: code == 'KUNDLI_SUBSCRIPTION_REQUIRED'
                ? 'An active Professional Kundli subscription is required.'
                : 'Professional Kundli access is currently unavailable.',
          ),
          subscriptionRequired: code == 'KUNDLI_SUBSCRIPTION_REQUIRED',
        );
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw KundliApiException(
          _readMessage(body, fallback: 'Unable to generate client Kundli.'),
        );
      }

      if (body['success'] != true) {
        throw KundliApiException(
          _readMessage(body, fallback: 'Unable to generate client Kundli.'),
        );
      }

      final data = _asMap(body['data']);

      if (data == null) {
        throw const KundliApiException(
          'The server returned an invalid Kundli response.',
        );
      }

      final report = _asMap(data['report']);

      if (report == null) {
        throw const KundliApiException(
          'The server returned an invalid Kundli report.',
        );
      }

      final savedRecordId = data['savedRecordId']?.toString().trim() ?? '';

      if (savedRecordId.isEmpty) {
        throw const KundliApiException(
          'Generated Kundli record ID is missing.',
        );
      }

      final provider = report['provider']?.toString().trim() ?? '';

      final status = report['status']?.toString().trim() ?? 'UNKNOWN';

      final completeness = _asMap(report['completeness']);

      final percentValue =
          completeness?['corePercent'] ?? completeness?['core'] ?? 0;

      final corePercent = percentValue is num
          ? percentValue.round()
          : int.tryParse(percentValue.toString()) ?? 0;

      return KundliGenerationResult(
        savedRecordId: savedRecordId,
        report: KundliReport(
          raw: report,
          provider: provider,
          status: status,
          coreCompletenessPercent: corePercent,
        ),
      );
    } on KundliApiException {
      rethrow;
    } catch (_) {
      throw const KundliApiException(
        'Unable to connect to the Professional Kundli service. Please try again.',
      );
    }
  }

  Future<Uint8List> downloadMyKundliPdf() async {
    final session = await _sessionStore.read();
    final accessToken = session?.accessToken.trim() ?? '';

    if (accessToken.isEmpty) {
      throw const KundliApiException(
        'Please login to continue.',
        loginRequired: true,
      );
    }

    try {
      final response = await _client
          .get(
            Uri.parse('${ApiConfig.baseUrl}/kundli/my-kundli/pdf'),
            headers: {
              'Accept': 'application/pdf',
              'Authorization': 'Bearer $accessToken',
            },
          )
          .timeout(const Duration(seconds: 180));

      if (response.statusCode == 401) {
        throw const KundliApiException(
          'Your session has expired. Please login again.',
          loginRequired: true,
        );
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        final body = _decodeBody(response.body);

        throw KundliApiException(
          _readMessage(body, fallback: 'Unable to download your Kundli PDF.'),
        );
      }

      final contentType = response.headers['content-type'] ?? '';

      if (!contentType.toLowerCase().contains('application/pdf')) {
        throw const KundliApiException(
          'The server returned an invalid Kundli PDF response.',
        );
      }

      final bytes = response.bodyBytes;

      if (bytes.isEmpty) {
        throw const KundliApiException('The generated Kundli PDF is empty.');
      }

      return Uint8List.fromList(bytes);
    } on KundliApiException {
      rethrow;
    } catch (_) {
      throw const KundliApiException(
        'Unable to connect to the Kundli PDF service. Please try again.',
      );
    }
  }

  Future<List<ProfessionalSavedKundli>> getProfessionalSavedKundlis() async {
    final session = await _sessionStore.read();
    final accessToken = session?.accessToken.trim() ?? '';

    if (accessToken.isEmpty) {
      throw const KundliApiException(
        'Please login to continue.',
        loginRequired: true,
      );
    }

    try {
      final response = await _client
          .get(
            Uri.parse('${ApiConfig.baseUrl}/kundli/saved'),
            headers: {
              'Accept': 'application/json',
              'Authorization': 'Bearer $accessToken',
            },
          )
          .timeout(ApiConfig.requestTimeout);

      final body = _decodeBody(response.body);

      if (response.statusCode == 401) {
        throw const KundliApiException(
          'Your session has expired. Please login again.',
          loginRequired: true,
        );
      }

      if (response.statusCode == 402 || response.statusCode == 403) {
        final code = body['code']?.toString().trim() ?? '';

        throw KundliApiException(
          _readMessage(
            body,
            fallback: code == 'SAVED_KUNDLI_DISABLED'
                ? 'Saved Kundlis are currently disabled by the administrator.'
                : 'An active Professional Kundli subscription is required.',
          ),
          subscriptionRequired: code == 'KUNDLI_SUBSCRIPTION_REQUIRED',
        );
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw KundliApiException(
          _readMessage(body, fallback: 'Unable to load saved Kundlis.'),
        );
      }

      if (body['success'] != true) {
        throw KundliApiException(
          _readMessage(body, fallback: 'Unable to load saved Kundlis.'),
        );
      }

      final data = body['data'];

      if (data is! List) {
        throw const KundliApiException(
          'The server returned an invalid saved Kundli list.',
        );
      }

      return data
          .whereType<Map>()
          .map(
            (item) => ProfessionalSavedKundli.fromJson(
              Map<String, dynamic>.from(item),
            ),
          )
          .where((record) => record.id.isNotEmpty)
          .toList(growable: false);
    } on KundliApiException {
      rethrow;
    } catch (_) {
      throw const KundliApiException(
        'Unable to connect to the saved Kundli service.',
      );
    }
  }

  Future<ProfessionalSavedKundliDetail> getProfessionalSavedKundli({
    required String savedRecordId,
  }) async {
    final id = savedRecordId.trim();

    if (id.isEmpty) {
      throw const KundliApiException('Saved Kundli record ID is missing.');
    }

    final session = await _sessionStore.read();
    final accessToken = session?.accessToken.trim() ?? '';

    if (accessToken.isEmpty) {
      throw const KundliApiException(
        'Please login to continue.',
        loginRequired: true,
      );
    }

    try {
      final response = await _client
          .get(
            Uri.parse('${ApiConfig.baseUrl}/kundli/saved/$id'),
            headers: {
              'Accept': 'application/json',
              'Authorization': 'Bearer $accessToken',
            },
          )
          .timeout(ApiConfig.requestTimeout);

      final body = _decodeBody(response.body);

      if (response.statusCode == 401) {
        throw const KundliApiException(
          'Your session has expired. Please login again.',
          loginRequired: true,
        );
      }

      if (response.statusCode == 402 || response.statusCode == 403) {
        final code = body['code']?.toString().trim() ?? '';

        throw KundliApiException(
          _readMessage(
            body,
            fallback: code == 'SAVED_KUNDLI_DISABLED'
                ? 'Saved Kundlis are currently disabled by the administrator.'
                : 'Professional Kundli access is unavailable.',
          ),
          subscriptionRequired: code == 'KUNDLI_SUBSCRIPTION_REQUIRED',
        );
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw KundliApiException(
          _readMessage(body, fallback: 'Unable to load saved Kundli.'),
        );
      }

      final data = _asMap(body['data']);

      if (body['success'] != true || data == null) {
        throw const KundliApiException(
          'The server returned an invalid saved Kundli.',
        );
      }

      return ProfessionalSavedKundliDetail.fromJson(data);
    } on KundliApiException {
      rethrow;
    } catch (_) {
      throw const KundliApiException(
        'Unable to connect to the saved Kundli service.',
      );
    }
  }

  Future<void> regenerateProfessionalSavedKundli({
    required String savedRecordId,
  }) async {
    final id = savedRecordId.trim();

    if (id.isEmpty) {
      throw const KundliApiException('Saved Kundli record ID is missing.');
    }

    final session = await _sessionStore.read();
    final accessToken = session?.accessToken.trim() ?? '';

    if (accessToken.isEmpty) {
      throw const KundliApiException(
        'Please login to continue.',
        loginRequired: true,
      );
    }

    try {
      final response = await _client
          .post(
            Uri.parse('${ApiConfig.baseUrl}/kundli/saved/$id/regenerate'),
            headers: {
              'Accept': 'application/json',
              'Authorization': 'Bearer $accessToken',
            },
          )
          .timeout(const Duration(seconds: 120));

      final body = _decodeBody(response.body);

      if (response.statusCode == 401) {
        throw const KundliApiException(
          'Your session has expired. Please login again.',
          loginRequired: true,
        );
      }

      if (response.statusCode == 402 || response.statusCode == 403) {
        final code = body['code']?.toString().trim() ?? '';

        throw KundliApiException(
          _readMessage(
            body,
            fallback: code == 'SAVED_KUNDLI_DISABLED'
                ? 'Saved Kundlis are currently disabled by the administrator.'
                : 'Professional Kundli access is unavailable.',
          ),
          subscriptionRequired: code == 'KUNDLI_SUBSCRIPTION_REQUIRED',
        );
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw KundliApiException(
          _readMessage(body, fallback: 'Unable to regenerate saved Kundli.'),
        );
      }

      if (body['success'] != true) {
        throw KundliApiException(
          _readMessage(
            body,
            fallback: 'The server returned an invalid regeneration response.',
          ),
        );
      }
    } on KundliApiException {
      rethrow;
    } catch (_) {
      throw const KundliApiException(
        'Unable to connect to the Kundli regeneration service. Please try again.',
      );
    }
  }

  Future<Uint8List> downloadSavedKundliPdf({
    required String savedRecordId,
  }) async {
    final id = savedRecordId.trim();

    if (id.isEmpty) {
      throw const KundliApiException('Saved Kundli record ID is missing.');
    }

    final session = await _sessionStore.read();
    final accessToken = session?.accessToken.trim() ?? '';

    if (accessToken.isEmpty) {
      throw const KundliApiException(
        'Please login to continue.',
        loginRequired: true,
      );
    }

    try {
      final response = await _client
          .get(
            Uri.parse('${ApiConfig.baseUrl}/kundli/saved/$id/pdf'),
            headers: {
              'Accept': 'application/pdf',
              'Authorization': 'Bearer $accessToken',
            },
          )
          .timeout(const Duration(seconds: 120));

      if (response.statusCode == 401) {
        throw const KundliApiException(
          'Your session has expired. Please login again.',
          loginRequired: true,
        );
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        final body = _decodeBody(response.body);

        throw KundliApiException(
          _readMessage(body, fallback: 'Unable to download Kundli PDF.'),
        );
      }

      final contentType = response.headers['content-type'] ?? '';

      if (!contentType.toLowerCase().contains('application/pdf')) {
        throw const KundliApiException(
          'The server returned an invalid Kundli PDF response.',
        );
      }

      if (response.bodyBytes.isEmpty) {
        throw const KundliApiException('The generated Kundli PDF is empty.');
      }

      return Uint8List.fromList(response.bodyBytes);
    } on KundliApiException {
      rethrow;
    } catch (_) {
      throw const KundliApiException(
        'Unable to connect to the Kundli PDF service. Please try again.',
      );
    }
  }

  Map<String, dynamic>? _extractReport(Map<String, dynamic> outerData) {
    /*
     * Current backend shape:
     *
     * {
     *   success: true,
     *   data: {
     *     success: true,
     *     data: {
     *       provider: "vedicastro",
     *       ...
     *     }
     *   }
     * }
     */

    final nestedData = _asMap(outerData['data']);

    if (nestedData != null) {
      return nestedData;
    }

    if (outerData.containsKey('provider')) {
      return outerData;
    }

    return null;
  }

  Map<String, dynamic> _decodeBody(String source) {
    if (source.trim().isEmpty) {
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
    } catch (_) {}

    return <String, dynamic>{};
  }

  static Map<String, dynamic>? _asMap(dynamic value) {
    if (value is Map<String, dynamic>) {
      return value;
    }

    if (value is Map) {
      return Map<String, dynamic>.from(value);
    }

    return null;
  }

  String _readMessage(Map<String, dynamic> body, {required String fallback}) {
    final message = body['message'];

    if (message is String && message.trim().isNotEmpty) {
      return message.trim();
    }

    if (message is List && message.isNotEmpty) {
      return message.map((item) => item.toString()).join('\n');
    }

    final response = body['response'];

    if (response is String && response.trim().isNotEmpty) {
      return response.trim();
    }

    if (response is Map) {
      final nestedMessage = response['message'];

      if (nestedMessage is String && nestedMessage.trim().isNotEmpty) {
        return nestedMessage.trim();
      }
    }

    return fallback;
  }

  void close() {
    _client.close();
  }
}
