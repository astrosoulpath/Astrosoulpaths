import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:astro_soul_path/features/articles/data/astrology_article.dart';
import 'package:astro_soul_path/features/articles/data/astrology_articles_api.dart';
import 'package:astro_soul_path/features/articles/presentation/screens/astrology_article_detail_screen.dart';

Map<String, dynamic> fixture() => {
  'id': 'synthetic-canonical-id',
  'slug': 'synthetic-article',
  'category': 'MOON_SIGN',
  'locale': 'hi',
  'title': 'सिंथेटिक लेख',
  'excerpt': 'Synthetic approved description',
  'contentMarkdown': '# Synthetic heading\n\nOriginal body remains unchanged.',
  'authorName': null,
  'readingMinutes': 3,
  'publishedAt': '2026-01-01T00:00:00Z',
};

void main() {
  test(
    'existing Flutter model preserves canonical IDs, Unicode and original body',
    () {
      final row = fixture();
      final article = AstrologyArticle.fromJson(row);
      expect(article.id, row['id']);
      expect(article.slug, row['slug']);
      expect(article.title, row['title']);
      expect(article.contentMarkdown, row['contentMarkdown']);
      expect(article.authorName, isNull);
    },
  );

  test(
    'Flutter consumes the same public array endpoint without Admin credentials',
    () async {
      final client = MockClient((request) async {
        expect(request.url.path, endsWith('/articles'));
        expect(request.url.queryParameters['locale'], 'hi');
        expect(request.url.queryParameters['country'], 'IN');
        expect(request.url.queryParameters['limit'], '10');
        expect(request.headers.containsKey('authorization'), isFalse);
        return http.Response(
          jsonEncode([fixture()]),
          200,
          headers: {'content-type': 'application/json; charset=utf-8'},
        );
      });
      final api = AstrologyArticlesApi(client: client);
      addTearDown(api.close);
      final articles = await api.getPublishedArticles(
        locale: 'hi',
        country: 'in',
      );
      expect(articles.single.id, 'synthetic-canonical-id');
      expect(articles.single.category, 'MOON_SIGN');
    },
  );

  test('empty list and API failure remain distinguishable', () async {
    final empty = AstrologyArticlesApi(
      client: MockClient((_) async => http.Response('[]', 200)),
    );
    addTearDown(empty.close);
    expect(await empty.getPublishedArticles(locale: 'en'), isEmpty);
    final failing = AstrologyArticlesApi(
      client: MockClient((_) async => http.Response('{}', 503)),
    );
    addTearDown(failing.close);
    await expectLater(
      failing.getPublishedArticles(locale: 'en'),
      throwsException,
    );
  });

  testWidgets(
    'existing detail navigation surface retains real title and body',
    (tester) async {
      final article = AstrologyArticle.fromJson(fixture());
      await tester.pumpWidget(
        MaterialApp(home: AstrologyArticleDetailScreen(article: article)),
      );
      expect(find.text(article.title), findsOneWidget);
      await tester.drag(find.byType(ListView), const Offset(0, -450));
      await tester.pump();
      expect(find.text(article.contentMarkdown), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}
