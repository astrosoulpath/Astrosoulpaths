class AppPreferences {
  const AppPreferences({
    required this.chartStyle,
    required this.monthType,
    required this.darkMode,
    required this.hideOuterPlanets,
    required this.customCalendar,
  });

  final String chartStyle;
  final String monthType;
  final bool darkMode;
  final bool hideOuterPlanets;
  final bool customCalendar;

  factory AppPreferences.fromJson(Map<String, dynamic> json) {
    return AppPreferences(
      chartStyle:
          json['chartStyle']?.toString().trim().toUpperCase() ?? 'NORTH_INDIAN',
      monthType: json['monthType']?.toString().trim().toUpperCase() ?? 'AMANT',
      darkMode: json['darkMode'] == true,
      hideOuterPlanets: json['hideOuterPlanets'] == true,
      customCalendar: json['customCalendar'] == true,
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'chartStyle': chartStyle,
      'monthType': monthType,
      'darkMode': darkMode,
      'hideOuterPlanets': hideOuterPlanets,
      'customCalendar': customCalendar,
    };
  }
}
