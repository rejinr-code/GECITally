import "package:intl/intl.dart";

const invalidKey = "__invalid__";

final _indianNumber = NumberFormat.decimalPattern("en_IN");

int ballotMarkCount(int? seats) => (seats == null || seats < 1) ? 1 : seats;

String ordinalMark(int slot) {
  final n = slot + 1;
  final suffix = n == 1
      ? "st"
      : n == 2
          ? "nd"
          : n == 3
              ? "rd"
              : "th";
  return "$n$suffix";
}

String invalidSlotKey(int slot) => "__invalid_${slot}__";

int marksToBallots(int marks, int? seats) {
  final per = ballotMarkCount(seats);
  if (per <= 1) return marks;
  return marks ~/ per;
}

double percent(num part, num total) {
  if (total <= 0) return 0;
  return ((part / total) * 1000).round() / 10;
}

String formatNumber(num value) => _indianNumber.format(value.round());

int countedBallotsFromRounds({
  required List<({String id, String status, int invalidVotes})> rounds,
  required List<({String roundId, int votes})> entries,
  int? seats,
}) {
  return rounds
      .where(
        (round) =>
            round.status == "verified" || round.status == "pending_verification",
      )
      .fold(0, (sum, round) {
    final candidateVotes = entries
        .where((entry) => entry.roundId == round.id)
        .fold(0, (inner, entry) => inner + entry.votes);
    return sum + marksToBallots(candidateVotes + round.invalidVotes, seats);
  });
}

String candidateClassLabel(String? branch, int? year, int? semester) {
  final code = branch?.trim().toUpperCase() ?? "";
  final resolvedYear = academicYear(year, semester);
  if (code.isNotEmpty && resolvedYear != null) {
    return "$code ${yearLabel(resolvedYear)} Year";
  }
  if (code.isNotEmpty) return code;
  if (resolvedYear != null) return "${yearLabel(resolvedYear)} Year";
  return "";
}

int? academicYear(int? year, int? semester) {
  if (year != null && year >= 1 && year <= 4) return year;
  if (semester != null && semester >= 1 && semester <= 8) {
    return (semester + 1) ~/ 2;
  }
  return null;
}

String yearLabel(int year) {
  const suffixes = {1: "st", 2: "nd", 3: "rd"};
  return "$year${suffixes[year] ?? "th"}";
}

({List<T> elected, List<T> tied}) resolveSeats<T>(
  List<T> ranked,
  int seats,
  int Function(T item) getVotes,
) {
  final elected = <T>[];
  final tied = <T>[];
  var remaining = seats < 0 ? 0 : seats;
  var index = 0;
  while (index < ranked.length && remaining > 0) {
    final votes = getVotes(ranked[index]);
    if (votes <= 0) break;
    var end = index + 1;
    while (end < ranked.length && getVotes(ranked[end]) == votes) {
      end += 1;
    }
    final group = ranked.sublist(index, end);
    if (group.length <= remaining) {
      elected.addAll(group);
      remaining -= group.length;
    } else {
      tied.addAll(group);
      remaining = 0;
    }
    index = end;
  }
  return (elected: elected, tied: tied);
}

int competitionRank<T>(
  List<T> ranked,
  int index,
  int Function(T item) getVotes,
) {
  final votes = getVotes(ranked[index]);
  return ranked.indexWhere((item) => getVotes(item) == votes) + 1;
}

List<T> rankByVotesThenName<T>(
  List<T> items,
  int Function(T item) getVotes,
  String Function(T item) getName,
) {
  final next = [...items];
  next.sort((a, b) {
    final voteDiff = getVotes(b) - getVotes(a);
    if (voteDiff != 0) return voteDiff;
    return getName(a).compareTo(getName(b));
  });
  return next;
}

bool countingRequiresSupervisor({
  bool? resultsRequireVerification,
  bool? countingRequireVerification,
}) {
  final results = resultsRequireVerification != false;
  final counting = countingRequireVerification != false;
  return counting && results;
}
