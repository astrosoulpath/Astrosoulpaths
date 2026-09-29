import 'package:flutter/material.dart';
import 'package:youtube_player_iframe/youtube_player_iframe.dart';

import '../../data/astrology_video.dart';

class AstrologyVideoDetailScreen extends StatefulWidget {
  const AstrologyVideoDetailScreen({required this.video, super.key});

  final AstrologyVideo video;

  @override
  State<AstrologyVideoDetailScreen> createState() =>
      _AstrologyVideoDetailScreenState();
}

class _AstrologyVideoDetailScreenState
    extends State<AstrologyVideoDetailScreen> {
  late final YoutubePlayerController _playerController;

  @override
  void initState() {
    super.initState();

    _playerController = YoutubePlayerController.fromVideoId(
      videoId: widget.video.youtubeVideoId,
      autoPlay: false,
      params: const YoutubePlayerParams(
        showFullscreenButton: true,
        enableCaption: true,
        strictRelatedVideos: true,
      ),
    );
  }

  @override
  void dispose() {
    _playerController.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final video = widget.video;
    final description = video.description?.trim().isNotEmpty == true
        ? video.description!.trim()
        : video.shortDescription?.trim() ?? '';

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
        elevation: 0.5,
        centerTitle: true,
        title: Text(
          video.title,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      body: ListView(
        children: [
          AspectRatio(
            aspectRatio: 16 / 9,
            child: YoutubePlayer(
              controller: _playerController,
              aspectRatio: 16 / 9,
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 40),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  video.title,
                  style: const TextStyle(
                    color: Color(0xFF121826),
                    fontSize: 28,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                if (description.isNotEmpty) ...[
                  const SizedBox(height: 18),
                  Text(
                    description,
                    style: const TextStyle(
                      color: Color(0xFF303848),
                      fontSize: 17,
                      height: 1.65,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
