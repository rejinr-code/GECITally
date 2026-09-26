import "package:flutter/material.dart";

import "../theme.dart";

class BrandLockup extends StatelessWidget {
  const BrandLockup({super.key, this.compact = false});

  final bool compact;

  @override
  Widget build(BuildContext context) {
    final size = compact ? 36.0 : 48.0;
    return Row(
      children: [
        Image.asset(
          "assets/geci-logo.png",
          width: size,
          height: size,
          filterQuality: FilterQuality.high,
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                "GECI Tally",
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
              ),
              if (!compact)
                const Text(
                  "Government Engineering College Idukki",
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 12,
                    color: GeciColors.mutedForeground,
                    height: 1.25,
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class StatusBadge extends StatelessWidget {
  const StatusBadge({
    super.key,
    required this.label,
    this.tone = BadgeTone.neutral,
  });

  final String label;
  final BadgeTone tone;

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = switch (tone) {
      BadgeTone.success => (GeciColors.emerald700, Colors.white),
      BadgeTone.warning => (const Color(0xFFFEF3C7), const Color(0xFF92400E)),
      BadgeTone.danger => (GeciColors.red50, GeciColors.red800),
      BadgeTone.gold => (GeciColors.amber300, GeciColors.emerald950),
      BadgeTone.sky => (GeciColors.sky200, GeciColors.sky950),
      BadgeTone.neutral => (GeciColors.muted, GeciColors.mutedForeground),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: fg,
          fontSize: 10,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.4,
        ),
      ),
    );
  }
}

enum BadgeTone { success, warning, danger, gold, sky, neutral }

class Notice extends StatelessWidget {
  const Notice({
    super.key,
    required this.text,
    this.tone = BadgeTone.warning,
  });

  final String text;
  final BadgeTone tone;

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = switch (tone) {
      BadgeTone.danger => (GeciColors.red50, GeciColors.red800),
      BadgeTone.success => (GeciColors.emerald50, GeciColors.emerald800),
      BadgeTone.warning => (GeciColors.amber50, GeciColors.amber700),
      _ => (GeciColors.muted, GeciColors.foreground),
    };
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(text, style: TextStyle(color: fg, fontSize: 13)),
    );
  }
}
