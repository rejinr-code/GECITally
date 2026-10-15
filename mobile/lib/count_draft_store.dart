import "dart:convert";

import "package:shared_preferences/shared_preferences.dart";

import "count_desk.dart";

class CountDraftStore {
  static String keyFor(String postId) => "geci-tally-count-draft:$postId";

  static Future<Map<String, dynamic>?> load(String postId, int roundNumber) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(keyFor(postId));
    if (raw == null) return null;
    try {
      final parsed = jsonDecode(raw);
      if (parsed is! Map) return null;
      final data = Map<String, dynamic>.from(parsed);
      if (data["postId"] != postId || data["roundNumber"] != roundNumber) {
        return null;
      }
      return data;
    } catch (_) {
      return null;
    }
  }

  static Future<void> save({
    required String postId,
    required int roundNumber,
    required CountDeskController desk,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    if (!desk.hasUnsavedBallots) {
      await prefs.remove(keyFor(postId));
      return;
    }
    await prefs.setString(
      keyFor(postId),
      jsonEncode({
        "postId": postId,
        "roundNumber": roundNumber,
        "votes": desk.votes,
        "pendingAdds": desk.pendingAdds,
        "candidateSlots": desk.candidateSlots,
        "pendingCandidateSlots": desk.pendingCandidateSlots,
        "draft": desk.draft,
        "lastId": desk.lastId,
        "lastSlot": desk.lastSlot,
        "savedAt": DateTime.now().millisecondsSinceEpoch,
      }),
    );
  }

  static Future<void> clear(String postId) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(keyFor(postId));
  }

  static Map<String, int> intMap(dynamic value) {
    if (value is! Map) return {};
    return {
      for (final entry in value.entries)
        if (entry.value is num) "${entry.key}": (entry.value as num).toInt(),
    };
  }

  static Map<String, List<int>> slotMap(dynamic value) {
    if (value is! Map) return {};
    return {
      for (final entry in value.entries)
        if (entry.value is List)
          "${entry.key}": [
            for (final item in entry.value as List)
              if (item is num) item.toInt(),
          ],
    };
  }

  static List<String?> draftList(dynamic value) {
    if (value is! List) return const [];
    return [for (final item in value) item is String ? item : null];
  }

  static bool applyTo(CountDeskController desk, Map<String, dynamic> data) {
    desk.applyRestored(
      restoredVotes: intMap(data["votes"]),
      restoredPending: intMap(data["pendingAdds"]),
      restoredSlots: slotMap(data["candidateSlots"]),
      restoredPendingSlots: slotMap(data["pendingCandidateSlots"]),
      restoredDraft: draftList(data["draft"]),
      restoredLastId: data["lastId"] is String ? data["lastId"] as String : null,
      restoredLastSlot: data["lastSlot"] is num ? (data["lastSlot"] as num).toInt() : null,
    );
    return desk.hasUnsavedBallots;
  }
}
