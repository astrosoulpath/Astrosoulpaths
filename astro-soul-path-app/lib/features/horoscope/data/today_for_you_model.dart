class TodayForYouModel {
  const TodayForYouModel({
    required this.title,
    required this.requestedDate,
    required this.overallScore,
    required this.headline,
    required this.dailyAdvice,
    required this.currentPhase,
    required this.lifeAreas,
    required this.timing,
    required this.panchang,
    required this.whyToday,
    required this.transparency,
  });

  final String title;
  final String? requestedDate;
  final double? overallScore;
  final String? headline;
  final String? dailyAdvice;

  final TodayForYouCurrentPhase currentPhase;
  final List<TodayForYouLifeArea> lifeAreas;
  final TodayForYouTiming timing;
  final TodayForYouPanchang panchang;
  final List<TodayForYouEvidence> whyToday;
  final TodayForYouTransparency transparency;

  factory TodayForYouModel.fromJson(Map<String, dynamic> json) {
    return TodayForYouModel(
      title: _string(json['title']) ?? 'Today For YOU',
      requestedDate: _string(json['requestedDate']),
      overallScore: _number(json['overallScore']),
      headline: _string(json['headline']),
      dailyAdvice: _string(json['dailyAdvice']),
      currentPhase: TodayForYouCurrentPhase.fromJson(
        _map(json['currentPhase']),
      ),
      lifeAreas: _list(json['lifeAreas'])
          .map(_map)
          .where((item) => item.isNotEmpty)
          .map(TodayForYouLifeArea.fromJson)
          .toList(growable: false),
      timing: TodayForYouTiming.fromJson(_map(json['timing'])),
      panchang: TodayForYouPanchang.fromJson(_map(json['panchang'])),
      whyToday: _list(json['whyToday'])
          .map(_map)
          .where((item) => item.isNotEmpty)
          .map(TodayForYouEvidence.fromJson)
          .toList(growable: false),
      transparency: TodayForYouTransparency.fromJson(
        _map(json['transparency']),
      ),
    );
  }

  bool get hasUsefulData {
    return overallScore != null ||
        headline != null ||
        dailyAdvice != null ||
        currentPhase.mahadasha != null ||
        currentPhase.antardasha != null ||
        lifeAreas.isNotEmpty ||
        whyToday.isNotEmpty ||
        panchang.hasData ||
        timing.hasData;
  }
}

class TodayForYouCurrentPhase {
  const TodayForYouCurrentPhase({
    required this.mahadasha,
    required this.antardasha,
  });

  final String? mahadasha;
  final String? antardasha;

  factory TodayForYouCurrentPhase.fromJson(Map<String, dynamic> json) {
    return TodayForYouCurrentPhase(
      mahadasha: _string(json['mahadasha']),
      antardasha: _string(json['antardasha']),
    );
  }

  String? get display {
    final maha = mahadasha;
    final antar = antardasha;

    if (maha != null && antar != null) {
      return '$maha → $antar';
    }

    return maha ?? antar;
  }
}

class TodayForYouLifeArea {
  const TodayForYouLifeArea({
    required this.key,
    required this.title,
    required this.guidance,
  });

  final String key;
  final String title;
  final String? guidance;

  factory TodayForYouLifeArea.fromJson(Map<String, dynamic> json) {
    return TodayForYouLifeArea(
      key: _string(json['key']) ?? '',
      title: _string(json['title']) ?? '',
      guidance: _string(json['guidance']),
    );
  }
}

class TodayForYouTiming {
  const TodayForYouTiming({
    required this.sunrise,
    required this.sunset,
    required this.rahuKaal,
    required this.abhijitMuhurat,
  });

  final String? sunrise;
  final String? sunset;
  final String? rahuKaal;
  final String? abhijitMuhurat;

  factory TodayForYouTiming.fromJson(Map<String, dynamic> json) {
    return TodayForYouTiming(
      sunrise: _string(json['sunrise']),
      sunset: _string(json['sunset']),
      rahuKaal: _string(json['rahuKaal']),
      abhijitMuhurat: _string(json['abhijitMuhurat']),
    );
  }

  bool get hasData =>
      sunrise != null ||
      sunset != null ||
      rahuKaal != null ||
      abhijitMuhurat != null;
}

class TodayForYouPanchang {
  const TodayForYouPanchang({
    required this.tithi,
    required this.nakshatra,
    required this.yoga,
    required this.karana,
  });

  final String? tithi;
  final String? nakshatra;
  final String? yoga;
  final String? karana;

  factory TodayForYouPanchang.fromJson(Map<String, dynamic> json) {
    return TodayForYouPanchang(
      tithi: _string(json['tithi']),
      nakshatra: _string(json['nakshatra']),
      yoga: _string(json['yoga']),
      karana: _string(json['karana']),
    );
  }

  bool get hasData =>
      tithi != null || nakshatra != null || yoga != null || karana != null;
}

class TodayForYouEvidence {
  const TodayForYouEvidence({
    required this.key,
    required this.label,
    required this.value,
    required this.source,
  });

  final String key;
  final String label;
  final String value;
  final String source;

  factory TodayForYouEvidence.fromJson(Map<String, dynamic> json) {
    return TodayForYouEvidence(
      key: _string(json['key']) ?? '',
      label: _string(json['label']) ?? '',
      value: _string(json['value']) ?? '',
      source: _string(json['source']) ?? '',
    );
  }

  bool get isUseful => label.isNotEmpty && value.isNotEmpty;
}

class TodayForYouTransparency {
  const TodayForYouTransparency({
    required this.scoreSource,
    required this.usesNatalChart,
    required this.usesCurrentMoon,
    required this.usesTransit,
    required this.usesDasha,
    required this.usesTarabala,
    required this.usesPanchang,
    required this.aiRole,
  });

  final String? scoreSource;
  final bool usesNatalChart;
  final bool usesCurrentMoon;
  final bool usesTransit;
  final bool usesDasha;
  final bool usesTarabala;
  final bool usesPanchang;
  final String? aiRole;

  factory TodayForYouTransparency.fromJson(Map<String, dynamic> json) {
    return TodayForYouTransparency(
      scoreSource: _string(json['scoreSource']),
      usesNatalChart: _bool(json['usesNatalChart']),
      usesCurrentMoon: _bool(json['usesCurrentMoon']),
      usesTransit: _bool(json['usesTransit']),
      usesDasha: _bool(json['usesDasha']),
      usesTarabala: _bool(json['usesTarabala']),
      usesPanchang: _bool(json['usesPanchang']),
      aiRole: _string(json['aiRole']),
    );
  }

  bool get isInterpretationOnly => aiRole == 'interpretation-only';

  List<String> get calculationSources {
    final items = <String>[];

    if (usesNatalChart) {
      items.add('Natal Chart');
    }

    if (usesCurrentMoon) {
      items.add('Current Moon');
    }

    if (usesTransit) {
      items.add('Planetary Transits');
    }

    if (usesDasha) {
      items.add('Dasha');
    }

    if (usesTarabala) {
      items.add('Tarabala');
    }

    if (usesPanchang) {
      items.add('Panchang');
    }

    return items;
  }
}

TodayForYouModel? parseTodayForYou(Map<String, dynamic>? dailyInsightData) {
  if (dailyInsightData == null) {
    return null;
  }

  final raw = _map(dailyInsightData['todayForYou']);

  if (raw.isEmpty) {
    return null;
  }

  final model = TodayForYouModel.fromJson(raw);

  if (!model.hasUsefulData) {
    return null;
  }

  return model;
}

Map<String, dynamic> _map(dynamic value) {
  if (value is Map<String, dynamic>) {
    return value;
  }

  if (value is Map) {
    return Map<String, dynamic>.from(value);
  }

  return <String, dynamic>{};
}

List<dynamic> _list(dynamic value) {
  if (value is List) {
    return value;
  }

  return const <dynamic>[];
}

String? _string(dynamic value) {
  if (value == null) {
    return null;
  }

  final text = value.toString().trim();

  if (text.isEmpty || text.toLowerCase() == 'null') {
    return null;
  }

  return text;
}

double? _number(dynamic value) {
  if (value is num) {
    return value.toDouble();
  }

  if (value is String) {
    return double.tryParse(value.trim());
  }

  return null;
}

bool _bool(dynamic value) {
  if (value is bool) {
    return value;
  }

  if (value is num) {
    return value != 0;
  }

  if (value is String) {
    final normalized = value.trim().toLowerCase();

    return normalized == 'true' || normalized == '1' || normalized == 'yes';
  }

  return false;
}
