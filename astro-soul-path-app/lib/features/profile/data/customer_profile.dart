class CustomerProfile {
  const CustomerProfile({
    required this.id,
    required this.userId,
    required this.name,
    required this.gender,
    required this.latitude,
    required this.longitude,
    required this.timezone,
    required this.birthDate,
    required this.birthTime,
    required this.birthTimeKnown,
    required this.isDeleted,
    this.timezoneName,
    this.fullName,
    this.city,
    this.state,
    this.country,
    this.countryCode,
    this.language,
    this.maritalStatus,
    this.occupation,
    this.avatarUrl,
  });

  final String id;
  final String userId;
  final String name;
  final String gender;
  final double latitude;
  final double longitude;
  final double timezone;
  final DateTime birthDate;
  final String birthTime;
  final bool birthTimeKnown;
  final bool isDeleted;

  final String? timezoneName;
  final String? fullName;
  final String? city;
  final String? state;
  final String? country;
  final String? countryCode;
  final String? language;
  final String? maritalStatus;
  final String? occupation;
  final String? avatarUrl;

  factory CustomerProfile.fromJson(Map<String, dynamic> json) {
    return CustomerProfile(
      id: json['id']?.toString() ?? '',
      userId: json['userId']?.toString() ?? '',
      name: (json['fullName'] ?? json['name'])?.toString() ?? '',
      gender: json['gender']?.toString() ?? 'OTHER',
      latitude: _readDouble(json['latitude'] ?? json['lat']),
      longitude: _readDouble(json['longitude'] ?? json['lon']),
      timezone: _readDouble(json['timezone']),
      birthDate:
          DateTime.tryParse(
            (json['dateOfBirth'] ?? json['birthDate'])?.toString() ?? '',
          ) ??
          DateTime.fromMillisecondsSinceEpoch(0),
      birthTime: (json['timeOfBirth'] ?? json['birthTime'])?.toString() ?? '',
      birthTimeKnown: json['birthTimeKnown'] != false,
      isDeleted: json['isDeleted'] == true,
      timezoneName: _readOptionalString(json['timezoneName']),
      fullName: _readOptionalString(json['fullName'] ?? json['fullname']),
      city: _readOptionalString(json['city']),
      state: _readOptionalString(json['state']),
      country: _readOptionalString(json['country']),
      countryCode: _readOptionalString(json['countryCode']),
      language: _readOptionalString(json['lang']),
      maritalStatus: _readOptionalString(json['maritalStatus']),
      occupation: _readOptionalString(json['occupation']),
      avatarUrl: _readOptionalString(json['avatarUrl']),
    );
  }

  static double _readDouble(Object? value) {
    if (value is num) {
      return value.toDouble();
    }

    return double.tryParse(value?.toString() ?? '') ?? 0;
  }

  static String? _readOptionalString(Object? value) {
    final text = value?.toString().trim() ?? '';
    return text.isEmpty ? null : text;
  }
}
