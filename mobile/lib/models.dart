int asInt(dynamic value, [int fallback = 0]) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse("$value") ?? fallback;
}

List<int>? asIntList(dynamic value) {
  if (value == null) return null;
  if (value is List) return value.map(asInt).toList();
  return null;
}

class Profile {
  const Profile({required this.id, required this.fullName, required this.role});

  final String id;
  final String fullName;
  final String role;

  factory Profile.fromJson(Map<String, dynamic> json) {
    return Profile(
      id: json["id"] as String,
      fullName: (json["full_name"] as String?) ?? "",
      role: (json["role"] as String?) ?? "",
    );
  }

  bool get isStaff => role == "staff";
}

class Election {
  const Election({
    required this.id,
    required this.name,
    required this.state,
    required this.countLimit,
    required this.resultsRequireVerification,
    required this.countingRequireVerification,
  });

  final String id;
  final String name;
  final String state;
  final int countLimit;
  final bool resultsRequireVerification;
  final bool countingRequireVerification;

  factory Election.fromJson(Map<String, dynamic> json) {
    return Election(
      id: json["id"] as String,
      name: (json["name"] as String?) ?? "Election",
      state: (json["state"] as String?) ?? "setup",
      countLimit: asInt(json["count_limit"], 1),
      resultsRequireVerification: json["results_require_verification"] != false,
      countingRequireVerification: json["counting_require_verification"] != false,
    );
  }

  bool get countingOpen => state == "counting";
}

class AssignedPost {
  const AssignedPost({
    required this.id,
    required this.name,
    required this.seats,
    required this.votesPolled,
  });

  final String id;
  final String name;
  final int seats;
  final int votesPolled;

  factory AssignedPost.fromJson(Map<String, dynamic> json) {
    return AssignedPost(
      id: json["id"] as String,
      name: (json["name"] as String?) ?? "",
      seats: asInt(json["seats"], 1),
      votesPolled: asInt(json["votes_polled"]),
    );
  }
}

class Candidate {
  const Candidate({
    required this.id,
    required this.name,
    required this.panelName,
    this.branch,
    this.year,
    this.semester,
    required this.displayOrder,
  });

  final String id;
  final String name;
  final String panelName;
  final String? branch;
  final int? year;
  final int? semester;
  final int displayOrder;

  factory Candidate.fromJson(Map<String, dynamic> json) {
    return Candidate(
      id: json["id"] as String,
      name: (json["name"] as String?) ?? "",
      panelName: ((json["panel_name"] as String?)?.trim().isNotEmpty ?? false)
          ? json["panel_name"] as String
          : "Independent",
      branch: json["branch"] as String?,
      year: json["year"] == null ? null : asInt(json["year"]),
      semester: json["semester"] == null ? null : asInt(json["semester"]),
      displayOrder: asInt(json["display_order"]),
    );
  }
}

class CountRound {
  const CountRound({
    required this.id,
    required this.postId,
    required this.staffId,
    required this.roundNumber,
    required this.status,
    this.remarks,
    required this.invalidVotes,
    this.invalidSlotVotes,
  });

  final String id;
  final String postId;
  final String staffId;
  final int roundNumber;
  final String status;
  final String? remarks;
  final int invalidVotes;
  final List<int>? invalidSlotVotes;

  factory CountRound.fromJson(Map<String, dynamic> json) {
    return CountRound(
      id: json["id"] as String,
      postId: json["post_id"] as String,
      staffId: json["staff_id"] as String,
      roundNumber: asInt(json["round_number"]),
      status: (json["status"] as String?) ?? "pending_verification",
      remarks: json["remarks"] as String?,
      invalidVotes: asInt(json["invalid_votes"]),
      invalidSlotVotes: asIntList(json["invalid_slot_votes"]),
    );
  }

  bool get isPending => status == "pending_verification";
  bool get isRejected => status == "rejected";
  bool get isActive =>
      status == "verified" || status == "pending_verification";
}

class CountEntry {
  const CountEntry({
    required this.id,
    required this.roundId,
    required this.candidateId,
    required this.votes,
    this.slotVotes,
  });

  final String id;
  final String roundId;
  final String candidateId;
  final int votes;
  final List<int>? slotVotes;

  factory CountEntry.fromJson(Map<String, dynamic> json) {
    return CountEntry(
      id: (json["id"] as String?) ?? "${json["round_id"]}-${json["candidate_id"]}",
      roundId: json["round_id"] as String,
      candidateId: json["candidate_id"] as String,
      votes: asInt(json["votes"]),
      slotVotes: asIntList(json["slot_votes"]),
    );
  }
}

class CountResult {
  const CountResult({
    required this.entries,
    required this.invalid,
    required this.invalidSlots,
  });

  final List<({String candidateId, int votes, List<int>? slotVotes})> entries;
  final int invalid;
  final List<int> invalidSlots;
}

class PostSummary {
  const PostSummary({
    required this.post,
    required this.counted,
    this.pending,
    this.rejected,
  });

  final AssignedPost post;
  final int counted;
  final CountRound? pending;
  final CountRound? rejected;
}

class DeskSnapshot {
  const DeskSnapshot({
    required this.post,
    required this.election,
    required this.candidates,
    required this.myRounds,
    required this.postRounds,
    required this.entries,
    required this.requireSupervisor,
    this.result,
  });

  final AssignedPost post;
  final Election election;
  final List<Candidate> candidates;
  final List<CountRound> myRounds;
  final List<CountRound> postRounds;
  final List<CountEntry> entries;
  final bool requireSupervisor;
  final CountResult? result;
}
