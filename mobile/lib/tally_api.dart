import "package:supabase_flutter/supabase_flutter.dart";

import "counting_math.dart";
import "models.dart";

class TallyApi {
  TallyApi(this.client);

  final SupabaseClient client;

  User? get user => client.auth.currentUser;

  Stream<AuthState> get authChanges => client.auth.onAuthStateChange;

  Future<void> signIn(String email, String password) {
    return client.auth.signInWithPassword(email: email, password: password);
  }

  Future<void> signOut() {
    return client.auth.signOut();
  }

  Future<Profile?> loadProfile(String userId) async {
    final row = await client
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", userId)
        .maybeSingle();
    if (row == null) return null;
    return Profile.fromJson(Map<String, dynamic>.from(row));
  }

  Future<({Election? election, List<PostSummary> posts})> loadAssignedPosts(
    String staffId,
  ) async {
    final electionRow = await client
        .from("elections")
        .select()
        .order("created_at", ascending: false)
        .limit(1)
        .maybeSingle();
    final election =
        electionRow == null ? null : Election.fromJson(Map<String, dynamic>.from(electionRow));

    final assignments = await client
        .from("staff_assignments")
        .select("post_id")
        .eq("staff_id", staffId);
    final postIds = (assignments as List)
        .map((row) => (row as Map)["post_id"] as String)
        .toList();
    if (postIds.isEmpty) return (election: election, posts: <PostSummary>[]);

    final posts = await client
        .from("posts")
        .select("id, name, seats, votes_polled")
        .inFilter("id", postIds);
    final rounds = await client
        .from("count_rounds")
        .select("id, post_id, staff_id, round_number, status, invalid_votes, invalid_slot_votes, remarks")
        .inFilter("post_id", postIds);
    final parsedRounds = (rounds as List)
        .map((row) => CountRound.fromJson(Map<String, dynamic>.from(row as Map)))
        .toList();
    final roundIds = parsedRounds.map((round) => round.id).toList();
    final entries = roundIds.isEmpty
        ? <CountEntry>[]
        : ((await client
                    .from("count_entries")
                    .select("id, round_id, candidate_id, votes, slot_votes")
                    .inFilter("round_id", roundIds) as List)
                .map((row) => CountEntry.fromJson(Map<String, dynamic>.from(row as Map)))
                .toList());

    final summaries = (posts as List).map((row) {
      final post = AssignedPost.fromJson(Map<String, dynamic>.from(row as Map));
      final postRounds = parsedRounds.where((round) => round.postId == post.id).toList();
      final mine = postRounds.where((round) => round.staffId == staffId).toList();
      return PostSummary(
        post: post,
        counted: countedBallotsFromRounds(
          rounds: [
            for (final round in postRounds)
              (id: round.id, status: round.status, invalidVotes: round.invalidVotes),
          ],
          entries: [
            for (final entry in entries)
              (roundId: entry.roundId, votes: entry.votes),
          ],
          seats: post.seats,
        ),
        pending: mine.where((round) => round.isPending).firstOrNull,
        rejected: mine.where((round) => round.isRejected).firstOrNull,
      );
    }).toList()
      ..sort((a, b) => a.post.name.compareTo(b.post.name));
    return (election: election, posts: summaries);
  }

  Future<DeskSnapshot> loadDesk({
    required String staffId,
    required String postId,
  }) async {
    final assignment = await client
        .from("staff_assignments")
        .select("id")
        .eq("staff_id", staffId)
        .eq("post_id", postId)
        .maybeSingle();
    if (assignment == null) {
      throw StateError("This post is not assigned to you.");
    }

    final postRow =
        await client.from("posts").select("id, name, seats, votes_polled, election_id").eq("id", postId).maybeSingle();
    if (postRow == null) {
      throw StateError("Post not found.");
    }
    final postMap = Map<String, dynamic>.from(postRow);
    final post = AssignedPost.fromJson(postMap);

    final electionRow = await client
        .from("elections")
        .select()
        .eq("id", postMap["election_id"] as String)
        .maybeSingle();
    if (electionRow == null) {
      throw StateError("Election not found.");
    }
    final election = Election.fromJson(Map<String, dynamic>.from(electionRow));

    final candidateRows = await client
        .from("candidates")
        .select()
        .eq("post_id", postId)
        .order("display_order");
    final candidates = (candidateRows as List)
        .map((row) => Candidate.fromJson(Map<String, dynamic>.from(row as Map)))
        .toList();

    final roundRows = await client.from("count_rounds").select().eq("post_id", postId);
    final postRounds = (roundRows as List)
        .map((row) => CountRound.fromJson(Map<String, dynamic>.from(row as Map)))
        .toList()
      ..sort((a, b) => b.roundNumber.compareTo(a.roundNumber));
    final myRounds = postRounds.where((round) => round.staffId == staffId).toList();
    final roundIds = postRounds.map((round) => round.id).toList();
    final entries = roundIds.isEmpty
        ? <CountEntry>[]
        : ((await client.from("count_entries").select().inFilter("round_id", roundIds) as List)
            .map((row) => CountEntry.fromJson(Map<String, dynamic>.from(row as Map)))
            .toList());

    final counted = countedBallotsFromRounds(
      rounds: [
        for (final round in postRounds)
          (id: round.id, status: round.status, invalidVotes: round.invalidVotes),
      ],
      entries: [
        for (final entry in entries) (roundId: entry.roundId, votes: entry.votes),
      ],
      seats: post.seats,
    );
    final postComplete = post.votesPolled > 0 && counted >= post.votesPolled;
    final requireSupervisor = countingRequiresSupervisor(
      resultsRequireVerification: election.resultsRequireVerification,
      countingRequireVerification: election.countingRequireVerification,
    );

    return DeskSnapshot(
      post: post,
      election: election,
      candidates: candidates,
      myRounds: myRounds,
      postRounds: postRounds,
      entries: entries,
      requireSupervisor: requireSupervisor,
      result: postComplete
          ? aggregatePostTallies(postRounds, entries, candidates, post.seats)
          : null,
    );
  }

  Future<String?> submitCountRound({
    required String postId,
    required List<Map<String, dynamic>> entries,
    required int invalidVotes,
    List<int>? invalidSlotVotes,
  }) async {
    try {
      await client.rpc(
        "submit_count_round",
        params: {
          "p_post_id": postId,
          "p_entries": entries,
          "p_invalid_votes": invalidVotes,
          if (invalidSlotVotes != null) "p_invalid_slot_votes": invalidSlotVotes,
        },
      );
      return null;
    } on PostgrestException catch (error) {
      return _roundError(error.message);
    } catch (error) {
      return error.toString();
    }
  }

  RealtimeChannel roundsChannel(void Function() onChange) {
    return client
        .channel("staff-count-rounds")
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: "public",
          table: "count_rounds",
          callback: (_) => onChange(),
        );
  }
}

String _roundError(String message) {
  if (message.contains("Duplicate")) {
    return "Duplicate round detected. This round was already submitted.";
  }
  if (message.contains("p_invalid_slot_votes") ||
      message.contains("invalid_slot_votes") ||
      message.contains("slot_votes") ||
      message.contains("schema cache")) {
    return "Run supabase/migrations/0014_multi_seat_ballots.sql and 0015_candidate_slot_votes.sql in the Supabase SQL editor first.";
  }
  if (message.contains("p_invalid_votes")) {
    return "Run supabase/migrations/0011_invalid_votes.sql in the Supabase SQL editor first.";
  }
  return message
      .replaceAll(
        "Only counting staff can submit rounds",
        "Only a Counting Supervisor can submit rounds",
      )
      .replaceAll(
        "A round is already awaiting supervisor verification",
        "A round is already awaiting Returning Officer verification",
      );
}

CountResult aggregatePostTallies(
  List<CountRound> rounds,
  List<CountEntry> entries,
  List<Candidate> candidates,
  int seats,
) {
  final slotCount = ballotMarkCount(seats);
  final activeIds = {
    for (final round in rounds)
      if (round.isActive) round.id,
  };
  final votes = {for (final candidate in candidates) candidate.id: 0};
  final slots = {
    for (final candidate in candidates)
      candidate.id: List<int>.filled(slotCount, 0),
  };
  var invalid = 0;
  final invalidSlots = List<int>.filled(slotCount, 0);

  for (final entry in entries.where((item) => activeIds.contains(item.roundId))) {
    votes[entry.candidateId] = (votes[entry.candidateId] ?? 0) + entry.votes;
    final marks = [...(slots[entry.candidateId] ?? List<int>.filled(slotCount, 0))];
    if (entry.slotVotes != null && entry.slotVotes!.isNotEmpty) {
      for (var slot = 0; slot < slotCount; slot += 1) {
        marks[slot] = marks[slot] + (slot < entry.slotVotes!.length ? entry.slotVotes![slot] : 0);
      }
    } else if (slotCount <= 1) {
      marks[0] = marks[0] + entry.votes;
    }
    slots[entry.candidateId] = marks;
  }

  for (final round in rounds.where((item) => activeIds.contains(item.id))) {
    invalid += round.invalidVotes;
    final roundSlots = (round.invalidSlotVotes != null && round.invalidSlotVotes!.isNotEmpty)
        ? round.invalidSlotVotes!
        : [round.invalidVotes];
    for (var slot = 0; slot < invalidSlots.length; slot += 1) {
      invalidSlots[slot] =
          invalidSlots[slot] + (slot < roundSlots.length ? roundSlots[slot] : 0);
    }
  }

  return CountResult(
    entries: [
      for (final candidate in candidates)
        (
          candidateId: candidate.id,
          votes: votes[candidate.id] ?? 0,
          slotVotes: slots[candidate.id],
        ),
    ],
    invalid: invalid,
    invalidSlots: invalidSlots,
  );
}

Map<String, CountResult> cumulativeRoundScores(
  List<CountRound> rounds,
  List<CountEntry> entries,
  List<Candidate> candidates,
  int seats,
) {
  final slotCount = ballotMarkCount(seats);
  final running = {for (final candidate in candidates) candidate.id: 0};
  final runningSlots = {
    for (final candidate in candidates)
      candidate.id: List<int>.filled(slotCount, 0),
  };
  var runningInvalid = 0;
  var runningInvalidSlots = List<int>.filled(slotCount, 0);
  final snapshots = <String, CountResult>{};

  final ordered = [...rounds]..sort((a, b) => a.roundNumber.compareTo(b.roundNumber));
  for (final round in ordered) {
    if (round.isRejected) {
      final ownVotes = {for (final candidate in candidates) candidate.id: 0};
      final ownSlots = {
        for (final candidate in candidates)
          candidate.id: List<int>.filled(slotCount, 0),
      };
      for (final entry in entries.where((item) => item.roundId == round.id)) {
        ownVotes[entry.candidateId] = entry.votes;
        final marks = List<int>.filled(slotCount, 0);
        if (entry.slotVotes != null && entry.slotVotes!.isNotEmpty) {
          for (var slot = 0; slot < slotCount; slot += 1) {
            marks[slot] = slot < entry.slotVotes!.length ? entry.slotVotes![slot] : 0;
          }
        } else if (slotCount <= 1) {
          marks[0] = entry.votes;
        }
        ownSlots[entry.candidateId] = marks;
      }
      snapshots[round.id] = CountResult(
        entries: [
          for (final candidate in candidates)
            (
              candidateId: candidate.id,
              votes: ownVotes[candidate.id] ?? 0,
              slotVotes: ownSlots[candidate.id],
            ),
        ],
        invalid: round.invalidVotes,
        invalidSlots: (round.invalidSlotVotes != null && round.invalidSlotVotes!.isNotEmpty)
            ? round.invalidSlotVotes!
            : [round.invalidVotes],
      );
      continue;
    }

    for (final entry in entries.where((item) => item.roundId == round.id)) {
      running[entry.candidateId] = (running[entry.candidateId] ?? 0) + entry.votes;
      final marks = [...(runningSlots[entry.candidateId] ?? List<int>.filled(slotCount, 0))];
      if (entry.slotVotes != null && entry.slotVotes!.isNotEmpty) {
        for (var slot = 0; slot < slotCount; slot += 1) {
          marks[slot] = marks[slot] + (slot < entry.slotVotes!.length ? entry.slotVotes![slot] : 0);
        }
      } else if (slotCount <= 1) {
        marks[0] = marks[0] + entry.votes;
      }
      runningSlots[entry.candidateId] = marks;
    }
    runningInvalid += round.invalidVotes;
    final roundSlots = (round.invalidSlotVotes != null && round.invalidSlotVotes!.isNotEmpty)
        ? round.invalidSlotVotes!
        : [round.invalidVotes];
    for (var slot = 0; slot < runningInvalidSlots.length; slot += 1) {
      runningInvalidSlots[slot] =
          runningInvalidSlots[slot] + (slot < roundSlots.length ? roundSlots[slot] : 0);
    }
    snapshots[round.id] = CountResult(
      entries: [
        for (final candidate in candidates)
          (
            candidateId: candidate.id,
            votes: running[candidate.id] ?? 0,
            slotVotes: [...(runningSlots[candidate.id] ?? List<int>.filled(slotCount, 0))],
          ),
      ],
      invalid: runningInvalid,
      invalidSlots: [...runningInvalidSlots],
    );
  }

  return snapshots;
}
