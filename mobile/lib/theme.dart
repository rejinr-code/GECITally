import "package:flutter/material.dart";
import "package:google_fonts/google_fonts.dart";

/// Tokens from the Next.js app `app/globals.css`.
abstract final class GeciColors {
  static const background = Color(0xFFF4F7F4);
  static const foreground = Color(0xFF0F2419);
  static const card = Color(0xFFFFFFFF);
  static const primary = Color(0xFF047857);
  static const primaryForeground = Color(0xFFF4FAF6);
  static const secondary = Color(0xFFE8F3EC);
  static const secondaryForeground = Color(0xFF065F46);
  static const muted = Color(0xFFEEF2EF);
  static const mutedForeground = Color(0xFF5B6B62);
  static const accent = Color(0xFFD1FAE5);
  static const accentForeground = Color(0xFF064E3B);
  static const destructive = Color(0xFFDC2626);
  static const border = Color(0xFFD7E3DB);
  static const ring = Color(0xFF059669);
  static const gold = Color(0xFFC9A227);
  static const amber50 = Color(0xFFFFFBEB);
  static const amber200 = Color(0xFFFDE68A);
  static const amber300 = Color(0xFFFCD34D);
  static const amber700 = Color(0xFFB45309);
  static const sky50 = Color(0xFFF0F9FF);
  static const sky200 = Color(0xFFBAE6FD);
  static const sky600 = Color(0xFF0284C7);
  static const sky700 = Color(0xFF0369A1);
  static const sky800 = Color(0xFF075985);
  static const sky950 = Color(0xFF082F49);
  static const red50 = Color(0xFFFEF2F2);
  static const red700 = Color(0xFFB91C1C);
  static const red800 = Color(0xFF991B1B);
  static const red900 = Color(0xFF7F1D1D);
  static const emerald50 = Color(0xFFECFDF5);
  static const emerald100 = Color(0xFFD1FAE5);
  static const emerald200 = Color(0xFFA7F3D0);
  static const emerald300 = Color(0xFF6EE7B7);
  static const emerald600 = Color(0xFF059669);
  static const emerald700 = Color(0xFF047857);
  static const emerald800 = Color(0xFF065F46);
  static const emerald900 = Color(0xFF064E3B);
  static const emerald950 = Color(0xFF022C22);
  static const violet50 = Color(0xFFF5F3FF);
  static const violet300 = Color(0xFFC4B5FD);
  static const violet700 = Color(0xFF6D28D9);
  static const violet950 = Color(0xFF2E1065);
}

class SlotTheme {
  const SlotTheme({
    required this.bar,
    required this.panel,
    required this.border,
    required this.text,
    required this.muted,
    required this.chip,
    required this.chipText,
    required this.vote,
    required this.last,
  });

  final Color bar;
  final Color panel;
  final Color border;
  final Color text;
  final Color muted;
  final Color chip;
  final Color chipText;
  final Color vote;
  final Color last;
}

const slotThemes = [
  SlotTheme(
    bar: GeciColors.emerald600,
    panel: Color(0xFFECFDF5),
    border: Color(0xFFA7F3D0),
    text: GeciColors.emerald900,
    muted: GeciColors.emerald800,
    chip: GeciColors.emerald700,
    chipText: Colors.white,
    vote: GeciColors.emerald700,
    last: Color(0xE6ECFDF5),
  ),
  SlotTheme(
    bar: GeciColors.sky600,
    panel: GeciColors.sky50,
    border: Color(0xFF7DD3FC),
    text: GeciColors.sky950,
    muted: GeciColors.sky800,
    chip: GeciColors.sky600,
    chipText: Colors.white,
    vote: GeciColors.sky600,
    last: GeciColors.sky50,
  ),
  SlotTheme(
    bar: GeciColors.violet700,
    panel: GeciColors.violet50,
    border: GeciColors.violet300,
    text: GeciColors.violet950,
    muted: Color(0xFF5B21B6),
    chip: GeciColors.violet700,
    chipText: Colors.white,
    vote: GeciColors.violet700,
    last: GeciColors.violet50,
  ),
];

SlotTheme slotTheme(int slot) {
  if (slot < 0) return slotThemes.first;
  if (slot >= slotThemes.length) return slotThemes.last;
  return slotThemes[slot];
}

ThemeData geciTheme() {
  final base = ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    scaffoldBackgroundColor: GeciColors.background,
    canvasColor: GeciColors.background,
    colorScheme: const ColorScheme.light(
      primary: GeciColors.primary,
      onPrimary: GeciColors.primaryForeground,
      secondary: GeciColors.secondary,
      onSecondary: GeciColors.secondaryForeground,
      surface: GeciColors.card,
      onSurface: GeciColors.foreground,
      error: GeciColors.destructive,
      onError: Color(0xFFFEF2F2),
      outline: GeciColors.border,
      outlineVariant: GeciColors.border,
    ),
  );

  final text = GoogleFonts.poppinsTextTheme(base.textTheme).apply(
    bodyColor: GeciColors.foreground,
    displayColor: GeciColors.foreground,
  );

  return base.copyWith(
    textTheme: text,
    appBarTheme: AppBarTheme(
      backgroundColor: GeciColors.card,
      foregroundColor: GeciColors.foreground,
      elevation: 0,
      scrolledUnderElevation: 0.5,
      centerTitle: false,
      titleTextStyle: text.titleMedium?.copyWith(
        fontWeight: FontWeight.w600,
        color: GeciColors.foreground,
      ),
    ),
    cardTheme: CardThemeData(
      color: GeciColors.card,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: const BorderSide(color: GeciColors.border),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: GeciColors.card,
      labelStyle: const TextStyle(color: GeciColors.mutedForeground),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: GeciColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: GeciColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: GeciColors.ring, width: 1.5),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: GeciColors.primary,
        foregroundColor: GeciColors.primaryForeground,
        minimumSize: const Size(48, 48),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: text.labelLarge?.copyWith(fontWeight: FontWeight.w600),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: GeciColors.foreground,
        side: const BorderSide(color: GeciColors.border),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    ),
    dividerColor: GeciColors.border,
    progressIndicatorTheme: const ProgressIndicatorThemeData(
      color: GeciColors.primary,
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: GeciColors.foreground,
      contentTextStyle: text.bodyMedium?.copyWith(color: Colors.white),
      behavior: SnackBarBehavior.floating,
    ),
  );
}
