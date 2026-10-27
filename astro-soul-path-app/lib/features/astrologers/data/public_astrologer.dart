import '../../../core/config/customer_consultation_policy.dart';

class PublicAstrologer {
  const PublicAstrologer({
    required this.id,
    required this.userId,
    required this.name,
    required this.avatarUrl,
    required this.bio,
    required this.gender,
    required this.languages,
    required this.experience,
    required this.pricePerMin,
    required this.rating,
    required this.isOnline,
    required this.isBusy,
    required this.isVerified,
    required this.chatWaitMinutes,
    required this.expertise,
    this.hasPublishedPrice = true,
    this.availabilityKnown = true,
  });

  factory PublicAstrologer.fromJson(Map<String, dynamic> json) {
    return PublicAstrologer(
      id: _readString(json['id']),
      userId: _readNullableString(json['userId'] ?? json['astrologerUserId']),
      name: _readString(json['name']).isNotEmpty
          ? _readString(json['name'])
          : 'Astro Soul Path Astrologer',
      avatarUrl: _readNullableString(json['avatarUrl']),
      bio: _readNullableString(json['bio']),
      gender: _readNullableString(json['gender']),
      languages: _readStringList(json['languages']),
      experience: _readNumber(json['experience']).clamp(0, double.infinity),
      pricePerMin: _readNumber(json['pricePerMin']).clamp(0, double.infinity),
      rating: _readNumber(json['rating']).clamp(0, 5),
      isOnline: json['isOnline'] == true,
      isBusy: json['isBusy'] == true,
      isVerified: json['isVerified'] == true || json['verified'] == true,
      chatWaitMinutes: _readNumber(
        json['chatWaitMinutes'],
      ).toInt().clamp(0, 1440),
      expertise: _readStringList(json['expertise']),
      hasPublishedPrice:
          json['pricePerMin'] != null &&
          num.tryParse(json['pricePerMin'].toString())?.isFinite == true &&
          num.parse(json['pricePerMin'].toString()) >= 0,
      availabilityKnown: json['isOnline'] is bool,
    );
  }

  final String id;
  final String? userId;
  final String name;
  final String? avatarUrl;
  final String? bio;
  final String? gender;
  final List<String> languages;
  final num experience;
  final num pricePerMin;
  final num rating;
  final bool isOnline;
  final bool isBusy;
  final bool isVerified;
  final int chatWaitMinutes;
  final List<String> expertise;
  final bool hasPublishedPrice;
  final bool availabilityKnown;

  String get primaryExpertise =>
      expertise.isEmpty ? 'Expertise not specified' : expertise.join(', ');

  String get languageLabel =>
      languages.isEmpty ? 'Not specified' : languages.join(', ');

  String get experienceLabel => experience > 0
      ? '${_formatNumber(experience)} years'
      : 'Experience not specified';

  String get priceLabel => hasPublishedPrice
      ? '\u{20B9}${_formatNumber(pricePerMin)}/min'
      : 'Price not available';

  String get ratingLabel => rating > 0 ? rating.toStringAsFixed(1) : 'New';

  static String _readString(Object? value) {
    return value is String ? value.trim() : '';
  }

  static String? _readNullableString(Object? value) {
    final text = _readString(value);

    return text.isEmpty ? null : text;
  }

  static List<String> _readStringList(Object? value) {
    if (value is! List) {
      return const [];
    }

    return value
        .whereType<String>()
        .map((item) => item.trim())
        .where((item) => item.isNotEmpty)
        .toList(growable: false);
  }

  static num _readNumber(Object? value) {
    if (value is num) {
      return value;
    }

    return num.tryParse(value?.toString() ?? '') ?? 0;
  }

  static String _formatNumber(num value) {
    return value % 1 == 0 ? value.toInt().toString() : value.toStringAsFixed(2);
  }
}

class PublicAstrologersResult {
  const PublicAstrologersResult({
    required this.astrologers,
    required this.total,
  });

  final List<PublicAstrologer> astrologers;
  final int total;
}

class PublicAstrologerProfile {
  const PublicAstrologerProfile({
    required this.astrologer,
    required this.availability,
    required this.consultationOptions,
  });

  factory PublicAstrologerProfile.fromJson(Map<String, dynamic> json) {
    final optionsSource = json['consultationOptions'];
    final options = optionsSource is Map
        ? Map<String, dynamic>.from(optionsSource)
        : <String, dynamic>{};

    final astrologer = PublicAstrologer.fromJson(json);
    final availabilitySource = json['availability']?.toString().trim() ?? '';

    return PublicAstrologerProfile(
      astrologer: astrologer,
      availability: availabilitySource.isNotEmpty
          ? availabilitySource
          : !astrologer.availabilityKnown
          ? 'Availability not provided'
          : astrologer.isOnline
          ? 'Available for consultation'
          : 'Currently offline',
      consultationOptions: ConsultationOptions(
        chat: options['chat'] == true,
        audioCall: options['audioCall'] == true,
        videoCall: options['videoCall'] == true,
      ),
    );
  }

  final PublicAstrologer astrologer;
  final String availability;
  final ConsultationOptions consultationOptions;

  bool get canRequestChat => astrologer.isOnline && consultationOptions.chat;
  bool get canRequestAudio =>
      astrologer.isOnline &&
      !astrologer.isBusy &&
      consultationOptions.audioCall;
  // Preserve parsed historical capability; do not advertise new customer video.
  bool get canRequestVideo =>
      CustomerConsultationPolicy.videoEnabled &&
      astrologer.isOnline &&
      !astrologer.isBusy &&
      consultationOptions.videoCall;
}

class ConsultationOptions {
  const ConsultationOptions({
    required this.chat,
    required this.audioCall,
    required this.videoCall,
  });

  final bool chat;
  final bool audioCall;
  final bool videoCall;
}
