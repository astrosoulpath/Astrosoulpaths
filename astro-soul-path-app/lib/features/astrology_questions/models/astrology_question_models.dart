class AstrologyQuestionCategory {
  const AstrologyQuestionCategory({
    required this.id,
    required this.slug,
    required this.name,
    required this.description,
    required this.icon,
    required this.sortOrder,
    required this.questionCount,
  });

  final String id;
  final String slug;
  final String name;
  final String description;
  final String icon;
  final int sortOrder;
  final int questionCount;

  factory AstrologyQuestionCategory.fromJson(Map<String, dynamic> json) {
    return AstrologyQuestionCategory(
      id: json['id']?.toString() ?? '',
      slug: json['slug']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      description: json['description']?.toString() ?? '',
      icon: json['icon']?.toString() ?? '',
      sortOrder: int.tryParse(json['sortOrder']?.toString() ?? '') ?? 0,
      questionCount: int.tryParse(json['questionCount']?.toString() ?? '') ?? 0,
    );
  }
}

class AstrologyQuestion {
  const AstrologyQuestion({
    required this.id,
    required this.text,
    required this.description,
    required this.sortOrder,
  });

  final String id;
  final String text;
  final String description;
  final int sortOrder;

  factory AstrologyQuestion.fromJson(Map<String, dynamic> json) {
    return AstrologyQuestion(
      id: json['id']?.toString() ?? '',
      text: json['text']?.toString() ?? '',
      description: json['description']?.toString() ?? '',
      sortOrder: int.tryParse(json['sortOrder']?.toString() ?? '') ?? 0,
    );
  }
}

class AstrologyQuestionCategoryDetails {
  const AstrologyQuestionCategoryDetails({
    required this.category,
    required this.questions,
  });

  final AstrologyQuestionCategory category;
  final List<AstrologyQuestion> questions;
}
