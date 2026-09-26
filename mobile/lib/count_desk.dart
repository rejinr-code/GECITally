import "package:flutter/foundation.dart";

import "counting_math.dart";
import "models.dart";

class CountRow {
  const CountRow({
    required this.id,
    required this.name,
    required this.panel,
    this.classLabel,
    required this.count,
    required this.pending,
    required this.invalid,
    this.slot,
  });

  final String id;
  final String name;
  final String panel;
  final String? classLabel;
  final int count;
  final int pending;
  final bool invalid;
  final int? slot;
}

class CountDeskController extends ChangeNotifier {
  CountDeskController({
    required this.candidates,
    required this.seats,
    required this.roundSize,
    required this.votesPolled,
    required this.countedBallots,
    required this.countingOpen,
    required this.requireSupervisor,
    this.pendingRound,
    this.rejectedRound,
  }) {
    resetTally();
  }

  final List<Candidate> candidates;
  final int seats;
  final int roundSize;
  final int votesPolled;
  final int countedBallots;
  final bool countingOpen;
  final bool requireSupervisor;
  final CountRound? pendingRound;
  final CountRound? rejectedRound;

  late Map<String, int> votes;
  late Map<String, int> pendingAdds;
  late Map<String, List<int>> candidateSlots;
  late Map<String, List<int>> pendingCandidateSlots;
  late List<String?> draft;
  String? lastId;
  int? lastSlot;
  String? error;
  bool isSubmitting = false;

  int get marksPerBallot => ballotMarkCount(seats);
  bool get multiSeat => marksPerBallot > 1;
  int? get remaining {
    if (votesPolled <= 0) return null;
    final left = votesPolled - countedBallots;
    return left < 0 ? 0 : left;
  }

  int get roundCap {
    final left = remaining;
    if (left == null) return roundSize;
    return left < roundSize ? left : roundSize;
  }
  bool get postComplete => remaining == 0;
  bool get isLastRound => remaining != null && remaining! > 0 && remaining! < roundSize;
  bool get exactRoundRequired => remaining != null;
  bool get waitingOnSupervisor => requireSupervisor && pendingRound != null;
  bool get blocked => waitingOnSupervisor || !countingOpen || postComplete;
  bool get fillingBallot => multiSeat && draft.any((slot) => slot != null);
  int get currentSlot {
    if (!multiSeat) return 0;
    final index = draft.indexWhere((slot) => slot == null);
    return index < 0 ? 0 : index;
  }

  int get invalidCount => invalidSlots.fold(0, (sum, value) => sum + value);

  List<int> get invalidSlots {
    if (multiSeat) {
      return List.generate(
        marksPerBallot,
        (slot) => votes[invalidSlotKey(slot)] ?? 0,
      );
    }
    return [votes[invalidKey] ?? 0];
  }

  int get committedMarks {
    final candidateVotes =
        candidates.fold(0, (sum, row) => sum + (votes[row.id] ?? 0));
    return candidateVotes + invalidCount;
  }

  int get pendingMarks =>
      pendingAdds.values.fold(0, (sum, value) => sum + value);

  int get committedTotal => marksToBallots(committedMarks, marksPerBallot);
  int get pendingTotal => marksToBallots(pendingMarks, marksPerBallot);

  bool get canCount =>
      !blocked && !isSubmitting && (fillingBallot || committedTotal < roundCap);

  bool get canConfirmQueued =>
      !blocked && !isSubmitting && pendingTotal > 0 && !fillingBallot;

  bool get roundFull =>
      roundCap > 0 && committedTotal + pendingTotal >= roundCap;

  bool get canSubmit =>
      !blocked &&
      !isSubmitting &&
      pendingTotal == 0 &&
      !fillingBallot &&
      committedTotal > 0 &&
      (exactRoundRequired
          ? committedTotal == roundCap
          : committedTotal <= roundSize);

  List<CountRow> get tableRows {
    return [
      ...candidates.map((candidate) {
        return CountRow(
          id: candidate.id,
          name: candidate.name,
          panel: candidate.panelName,
          classLabel: candidateClassLabel(
            candidate.branch,
            candidate.year,
            candidate.semester,
          ),
          count: votes[candidate.id] ?? 0,
          pending: pendingAdds[candidate.id] ?? 0,
          invalid: false,
        );
      }),
      if (multiSeat)
        ...List.generate(marksPerBallot, (slot) {
          return CountRow(
            id: invalidSlotKey(slot),
            name: "Invalid ${ordinalMark(slot)}",
            panel: "Spoilt / rejected",
            count: votes[invalidSlotKey(slot)] ?? 0,
            pending: pendingAdds[invalidSlotKey(slot)] ?? 0,
            invalid: true,
            slot: slot,
          );
        })
      else
        CountRow(
          id: invalidKey,
          name: "Invalid",
          panel: "Spoilt / rejected",
          count: invalidSlots.first,
          pending: pendingAdds[invalidKey] ?? 0,
          invalid: true,
          slot: 0,
        ),
    ];
  }

  Map<String, int> emptyTally() {
    final tally = <String, int>{
      for (final candidate in candidates) candidate.id: 0,
    };
    if (marksPerBallot <= 1) {
      tally[invalidKey] = 0;
    } else {
      for (var slot = 0; slot < marksPerBallot; slot += 1) {
        tally[invalidSlotKey(slot)] = 0;
      }
    }
    return tally;
  }

  Map<String, List<int>> emptySlotMap() {
    return {
      for (final candidate in candidates)
        candidate.id: List<int>.filled(marksPerBallot, 0),
    };
  }

  List<String?> emptyDraft() => List<String?>.filled(marksPerBallot, null);

  void resetTally() {
    votes = emptyTally();
    pendingAdds = {};
    candidateSlots = emptySlotMap();
    pendingCandidateSlots = emptySlotMap();
    draft = emptyDraft();
    lastId = null;
    lastSlot = null;
    error = null;
    notifyListeners();
  }

  String? queueVote(String candidateId) {
    if (!canCount) return error;
    error = null;

    if (!multiSeat) {
      pendingAdds = {candidateId: 1};
      lastId = candidateId;
      lastSlot = 0;
      notifyListeners();
      return null;
    }

    if (pendingTotal > 0 && !fillingBallot) {
      error = "Confirm this ballot first.";
      notifyListeners();
      return error;
    }

    final slot = currentSlot;
    final isInvalidMark = candidateId.startsWith("__invalid_");
    if (isInvalidMark && candidateId != invalidSlotKey(slot)) {
      error = "Cast the ${ordinalMark(slot)} vote on this ballot first.";
      notifyListeners();
      return error;
    }
    if (!isInvalidMark && draft.contains(candidateId)) {
      error = "This candidate is already marked on this ballot.";
      notifyListeners();
      return error;
    }

    final next = [...draft];
    next[slot] = candidateId;
    lastId = candidateId;
    lastSlot = slot;
    if (next.every((id) => id != null)) {
      final queued = <String, int>{};
      for (final id in next) {
        if (id == null) continue;
        queued[id] = (queued[id] ?? 0) + 1;
      }
      pendingAdds = queued;
      final queuedSlots = emptySlotMap();
      for (var i = 0; i < next.length; i += 1) {
        final id = next[i];
        if (id == null || id.startsWith("__invalid")) continue;
        final marks = [...(queuedSlots[id] ?? List<int>.filled(marksPerBallot, 0))];
        marks[i] = (marks[i]) + 1;
        queuedSlots[id] = marks;
      }
      pendingCandidateSlots = queuedSlots;
      draft = emptyDraft();
    } else {
      draft = next;
    }
    notifyListeners();
    return null;
  }

  void clearQueued() {
    pendingAdds = {};
    pendingCandidateSlots = emptySlotMap();
    draft = emptyDraft();
    error = null;
    notifyListeners();
  }

  bool confirmQueued() {
    if (!canConfirmQueued) return false;
    for (final entry in pendingAdds.entries) {
      if (entry.value > 0) {
        votes[entry.key] = (votes[entry.key] ?? 0) + entry.value;
      }
    }
    for (final entry in pendingCandidateSlots.entries) {
      final current = candidateSlots[entry.key] ?? List<int>.filled(marksPerBallot, 0);
      candidateSlots[entry.key] = [
        for (var slot = 0; slot < marksPerBallot; slot += 1)
          current[slot] + (entry.value[slot]),
      ];
    }
    pendingAdds = {};
    pendingCandidateSlots = emptySlotMap();
    notifyListeners();
    return true;
  }

  void recountRound() {
    isSubmitting = false;
    resetTally();
  }

  List<Map<String, dynamic>> submitEntries() {
    return [
      for (final candidate in candidates)
        {
          "candidate_id": candidate.id,
          "votes": votes[candidate.id] ?? 0,
          if (multiSeat) "slot_votes": candidateSlots[candidate.id] ?? [],
        },
    ];
  }

  List<int>? submitInvalidSlots() => multiSeat ? invalidSlots : null;

  bool voteDisabled(CountRow row) {
    final alreadyOnBallot = multiSeat && !row.invalid && draft.contains(row.id);
    final wrongInvalidSlot = multiSeat &&
        row.invalid &&
        row.slot != null &&
        row.slot != currentSlot;
    return !canCount ||
        alreadyOnBallot ||
        wrongInvalidSlot ||
        (multiSeat && pendingTotal > 0 && !fillingBallot);
  }

  String? labelForId(String? id) {
    if (id == null) return null;
    if (id == invalidKey) return "Invalid";
    if (id.startsWith("__invalid_")) {
      final slot = int.tryParse(
        id.replaceAll("__invalid_", "").replaceAll("__", ""),
      );
      return slot == null ? "Invalid" : "Invalid ${ordinalMark(slot)}";
    }
    return candidates
        .where((candidate) => candidate.id == id)
        .map((candidate) => candidate.name)
        .firstOrNull;
  }

  Future<String?> runSubmit(Future<String?> Function() submit) async {
    if (isSubmitting) return "Already submitting.";
    isSubmitting = true;
    notifyListeners();
    try {
      final message = await submit();
      if (message != null) {
        error = message;
        return message;
      }
      resetTally();
      return null;
    } finally {
      isSubmitting = false;
      notifyListeners();
    }
  }
}
