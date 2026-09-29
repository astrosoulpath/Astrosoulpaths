import 'dart:ui';

import 'package:flutter/material.dart';

import '../../data/astrology_video.dart';
import '../../data/astrology_videos_api.dart';
import '../screens/astrology_video_detail_screen.dart';

class AstrologyVideosHomeSection extends StatefulWidget {
  const AstrologyVideosHomeSection({super.key});

  @override
  State<AstrologyVideosHomeSection> createState() =>
      _AstrologyVideosHomeSectionState();
}

class _AstrologyVideosHomeSectionState
    extends State<AstrologyVideosHomeSection> {
  final AstrologyVideosApi _api = AstrologyVideosApi();

  List<AstrologyVideo> _videos = const [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadVideos();
  }

  Future<void> _loadVideos() async {
    final locale = PlatformDispatcher.instance.locale;
    final language = locale.languageCode.trim().isEmpty
        ? 'en'
        : locale.languageCode.toLowerCase();

    try {
      final videos = await _api.getPublishedVideos(
        locale: language,
        country: locale.countryCode,
      );

      if (!mounted) return;

      setState(() {
        _videos = videos;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;

      setState(() => _loading = false);
    }
  }

  @override
  void dispose() {
    _api.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Padding(
        padding: EdgeInsets.fromLTRB(20, 18, 20, 8),
        child: LinearProgressIndicator(),
      );
    }

    if (_videos.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(top: 18, bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 20),
            child: Text(
              "Astrology's lessons",
              style: TextStyle(
                color: Color(0xFF17213A),
                fontSize: 23,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 190,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              scrollDirection: Axis.horizontal,
              itemCount: _videos.length,
              separatorBuilder: (_, _) => const SizedBox(width: 12),
              itemBuilder: (context, index) {
                final video = _videos[index];

                return InkWell(
                  borderRadius: BorderRadius.circular(14),
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) =>
                            AstrologyVideoDetailScreen(video: video),
                      ),
                    );
                  },
                  child: SizedBox(
                    width: 190,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(14),
                          child: Stack(
                            alignment: Alignment.center,
                            children: [
                              Image.network(
                                video.resolvedThumbnailUrl,
                                width: 190,
                                height: 118,
                                fit: BoxFit.cover,
                                errorBuilder: (_, _, _) => Container(
                                  width: 190,
                                  height: 118,
                                  color: const Color(0xFF17213A),
                                  child: const Icon(
                                    Icons.play_circle_fill_rounded,
                                    color: Colors.white,
                                    size: 48,
                                  ),
                                ),
                              ),
                              Container(
                                width: 52,
                                height: 40,
                                decoration: BoxDecoration(
                                  color: const Color(0xFFE62117),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: const Icon(
                                  Icons.play_arrow_rounded,
                                  color: Colors.white,
                                  size: 32,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          video.title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Color(0xFF17213A),
                            fontSize: 15,
                            height: 1.18,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
