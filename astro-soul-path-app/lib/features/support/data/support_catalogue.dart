class SupportQuestion {
  const SupportQuestion({required this.id, required this.text});
  final String id, text;
}

class SupportCategory {
  const SupportCategory({
    required this.id,
    required this.title,
    required this.questions,
  });
  final String id, title;
  final List<SupportQuestion> questions;
}

class SupportCatalogue {
  const SupportCatalogue({
    required this.welcome,
    required this.categories,
    this.visible = true,
    this.revision = 0,
  });
  final String welcome;
  final bool visible;
  final int revision;
  final List<SupportCategory> categories;
  factory SupportCatalogue.fromJson(Map<String, dynamic> json) {
    final raw = json['categories'];
    final revision = json['revision'] ?? 0;
    if (revision is! int || revision < 0) {
      throw const FormatException('Invalid support catalogue revision');
    }
    if (json['welcome'] is! String ||
        json['visible'] is! bool ||
        raw is! List ||
        raw.length > 3) {
      throw const FormatException('Invalid support topics');
    }
    final categories = <SupportCategory>[];
    final ids = <String>{};
    for (final c in raw) {
      if (c is! Map ||
          !['payment', 'consultation', 'account'].contains(c['id']) ||
          c['title'] is! String ||
          c['enabled'] is! bool ||
          c['questions'] is! List) {
        throw const FormatException('Invalid support category');
      }
      final questions = <SupportQuestion>[];
      for (final q in c['questions'] as List) {
        if (q is! Map ||
            q['id'] is! String ||
            q['text'] is! String ||
            q['enabled'] is! bool ||
            !ids.add(q['id'] as String)) {
          throw const FormatException('Invalid support question');
        }
        if (q['enabled'] == true) {
          questions.add(
            SupportQuestion(id: q['id'] as String, text: q['text'] as String),
          );
        }
      }
      if (c['enabled'] == true) {
        categories.add(
          SupportCategory(
            id: c['id'] as String,
            title: c['title'] as String,
            questions: questions,
          ),
        );
      }
    }
    return SupportCatalogue(
      revision: revision,
      welcome: json['welcome'] as String,
      visible: json['visible'] == true,
      categories: json['visible'] == true ? categories : [],
    );
  }
}
