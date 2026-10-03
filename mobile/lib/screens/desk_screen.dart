import "dart:async";
import "dart:math" as math;

import "package:flutter/material.dart";
import "package:supabase_flutter/supabase_flutter.dart";

import "../count_desk.dart";
import "../counting_math.dart";
import "../models.dart";
import "../session.dart";
import "../tally_api.dart";
import "../theme.dart";
import "../widgets/brand.dart";

class DeskScreen extends StatefulWidget {
  const DeskScreen({
    super.key,
    required this.session,
    required this.api,
    required this.postId,
  });

  final SessionController session;
  final TallyApi api;
  final String postId;

  @override
  State<DeskScreen> createState() => _DeskScreenState();
}

class _DeskScreenState extends State<DeskScreen> {
  DeskSnapshot? _snapshot;
  CountDeskController? _desk;
  bool _loading = true;
  String? _error;
  RealtimeChannel? _channel;

  @override
  void initState() {
    super.initState();
    unawaited(_reload());
    _channel = widget.api.roundsChannel(() {
      final desk = _desk;
      if (!mounted || desk == null) return;
      if (desk.blocked || desk.committedTotal == 0 && desk.pendingTotal == 0) {
        unawaited(_reload(silent: true));
      }
    })
      ..subscribe();
  }

  @override
  void dispose() {
    _desk?.dispose();
    final channel = _channel;
    if (channel != null) {
      unawaited(widget.api.client.removeChannel(channel));
    }
    super.dispose();
  }

  Future<void> _reload({bool silent = false}) async {
    final userId = widget.session.user?.id;
    if (userId == null) return;
    if (!silent) setState(() => _loading = true);
    try {
      final snapshot = await widget.api.loadDesk(
        staffId: userId,
        postId: widget.postId,
      );
      if (!mounted) return;
      _desk?.dispose();
      final counted = countedBallotsFromRounds(
        rounds: [
          for (final round in snapshot.postRounds)
            (id: round.id, status: round.status, invalidVotes: round.invalidVotes),
        ],
        entries: [
          for (final entry in snapshot.entries) (roundId: entry.roundId, votes: entry.votes),
        ],
        seats: snapshot.post.seats,
      );
      setState(() {
        _snapshot = snapshot;
        _desk = CountDeskController(
          candidates: snapshot.candidates,
          seats: snapshot.post.seats,
          roundSize: math.max(1, snapshot.election.countLimit),
          votesPolled: snapshot.post.votesPolled,
          countedBallots: counted,
          countingOpen: snapshot.election.countingOpen,
          requireSupervisor: snapshot.requireSupervisor,
          pendingRound: snapshot.myRounds.where((round) => round.isPending).firstOrNull,
          rejectedRound: snapshot.myRounds.where((round) => round.isRejected).firstOrNull,
        );
        _error = null;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.toString();
        _loading = false;
      });
    }
  }

  int _nextRound(DeskSnapshot snapshot) {
    final rejected = snapshot.myRounds.where((round) => round.isRejected).firstOrNull;
    if (rejected != null) return rejected.roundNumber;
    if (snapshot.myRounds.isEmpty) return 1;
    return snapshot.myRounds.map((round) => round.roundNumber).reduce(math.max) + 1;
  }

  @override
  Widget build(BuildContext context) {
    final snapshot = _snapshot;
    final desk = _desk;
    return Scaffold(
      appBar: AppBar(
        title: Text(snapshot?.post.name ?? "Counting desk"),
      ),
      body: _loading && snapshot == null
          ? const Center(child: CircularProgressIndicator())
          : _error != null && snapshot == null
              ? Padding(
                  padding: const EdgeInsets.all(20),
                  child: Notice(text: _error!, tone: BadgeTone.danger),
                )
              : snapshot == null || desk == null
                  ? const SizedBox.shrink()
                  : RefreshIndicator(
                      onRefresh: _reload,
                      child: ListenableBuilder(
                        listenable: desk,
                        builder: (context, _) {
                          final waiting = desk.waitingOnSupervisor;
                          final countingFinished = desk.postComplete && !waiting;
                          return countingFinished
                              ? _FinishedView(snapshot: snapshot)
                              : _CountingView(
                                  snapshot: snapshot,
                                  desk: desk,
                                  roundNumber: _nextRound(snapshot),
                                  onReload: _reload,
                                  api: widget.api,
                                );
                        },
                      ),
                    ),
    );
  }
}

class _CountingView extends StatelessWidget {
  const _CountingView({
    required this.snapshot,
    required this.desk,
    required this.roundNumber,
    required this.onReload,
    required this.api,
  });

  final DeskSnapshot snapshot;
  final CountDeskController desk;
  final int roundNumber;
  final Future<void> Function({bool silent}) onReload;
  final TallyApi api;

  Future<void> _onVote(BuildContext context, String id) async {
    desk.queueVote(id);
  }

  Future<void> _onConfirm(BuildContext context) async {
    final reached = desk.roundFull && desk.canConfirmQueued;
    desk.confirmQueued();
    if (reached && desk.canSubmit && context.mounted) {
      await _openLimitDialog(context);
    }
  }

  Future<void> _openLimitDialog(BuildContext context) async {
    final last = desk.isLastRound;
    await showDialog<void>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: Text(last ? "Last round complete" : "Round count reached"),
          content: Text(
            last
                ? "This last round has ${formatNumber(desk.committedTotal)} ballots, which is all that remain for this post. Review and submit this round."
                : "This round has reached the set count of ${formatNumber(desk.roundSize)} ballots. Review and submit this round.",
          ),
          actions: [
            TextButton(
              onPressed: () {
                desk.recountRound();
                Navigator.pop(context);
              },
              child: const Text("Recount"),
            ),
            FilledButton(
              onPressed: () {
                Navigator.pop(context);
                unawaited(_openSubmit(context));
              },
              child: const Text("Review and submit"),
            ),
          ],
        );
      },
    );
  }

  Future<void> _openSubmit(BuildContext context) async {
    if (!desk.canSubmit) return;
    await showDialog<void>(
      context: context,
      barrierDismissible: !desk.isSubmitting,
      builder: (dialogContext) {
        return ListenableBuilder(
          listenable: desk,
          builder: (context, _) {
            final maxListHeight = (MediaQuery.sizeOf(context).height * 0.4).clamp(140.0, 280.0);
            final rowCount = snapshot.candidates.length + desk.invalidSlots.length;
            final listHeight = (rowCount * 52.0).clamp(52.0, maxListHeight).toDouble();
            return Dialog(
              insetPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 24),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 18, 20, 12),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 400),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        "Round $roundNumber — ${snapshot.post.name}",
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        snapshot.requireSupervisor
                            ? "Confirm these sequential totals. This round will wait for Returning Officer verification."
                            : "Confirm these sequential totals. This round will be accepted immediately.",
                        style: const TextStyle(color: GeciColors.mutedForeground, fontSize: 13),
                      ),
                      const SizedBox(height: 12),
                      SizedBox(
                        height: listHeight,
                        child: ListView(
                          children: [
                            ...snapshot.candidates.map((candidate) {
                              final classLabel = candidateClassLabel(
                                candidate.branch,
                                candidate.year,
                                candidate.semester,
                              );
                              final slots = desk.candidateSlots[candidate.id] ?? [];
                              return Padding(
                                padding: const EdgeInsets.symmetric(vertical: 6),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Expanded(
                                      child: Text(
                                        classLabel.isEmpty
                                            ? candidate.name
                                            : "${candidate.name}  $classLabel",
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Column(
                                      crossAxisAlignment: CrossAxisAlignment.end,
                                      children: [
                                        Text(
                                          formatNumber(desk.votes[candidate.id] ?? 0),
                                          style: const TextStyle(fontWeight: FontWeight.w700),
                                        ),
                                        if (desk.multiSeat)
                                          Text(
                                            [
                                              for (var slot = 0; slot < slots.length; slot += 1)
                                                "${ordinalMark(slot)} ${formatNumber(slots[slot])}",
                                            ].join(" · "),
                                            style: const TextStyle(
                                              fontSize: 11,
                                              color: GeciColors.mutedForeground,
                                            ),
                                          ),
                                      ],
                                    ),
                                  ],
                                ),
                              );
                            }),
                            ...List.generate(desk.invalidSlots.length, (slot) {
                              return Padding(
                                padding: const EdgeInsets.symmetric(vertical: 6),
                                child: Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        desk.multiSeat ? "Invalid ${ordinalMark(slot)}" : "Invalid",
                                        style: const TextStyle(color: GeciColors.red700),
                                      ),
                                    ),
                                    Text(
                                      formatNumber(desk.invalidSlots[slot]),
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w700,
                                        color: GeciColors.red700,
                                      ),
                                    ),
                                  ],
                                ),
                              );
                            }),
                          ],
                        ),
                      ),
                      const Divider(),
                      Text(
                        "Total ballots: ${formatNumber(desk.committedTotal)}. Confirm?",
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      if (desk.error != null) ...[
                        const SizedBox(height: 8),
                        Notice(text: desk.error!, tone: BadgeTone.danger),
                      ],
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: TextButton(
                              onPressed: desk.isSubmitting
                                  ? null
                                  : () {
                                      desk.recountRound();
                                      Navigator.pop(dialogContext);
                                    },
                              child: const Text("Recount"),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: FilledButton(
                              onPressed: desk.isSubmitting
                                  ? null
                                  : () async {
                                      final message = await desk.runSubmit(() {
                                        return api.submitCountRound(
                                          postId: snapshot.post.id,
                                          entries: desk.submitEntries(),
                                          invalidVotes: desk.invalidCount,
                                          invalidSlotVotes: desk.submitInvalidSlots(),
                                        );
                                      });
                                      if (!dialogContext.mounted) return;
                                      if (message != null) return;
                                      Navigator.pop(dialogContext);
                                      await onReload();
                                      if (context.mounted) {
                                        ScaffoldMessenger.of(context).showSnackBar(
                                          SnackBar(
                                            content: Text(
                                              snapshot.requireSupervisor
                                                  ? "Round $roundNumber submitted for verification."
                                                  : "Round $roundNumber accepted. You can start the next round.",
                                            ),
                                          ),
                                        );
                                      }
                                    },
                              child: Text(desk.isSubmitting ? "Saving..." : "Confirm round"),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = slotTheme(desk.activeSlotOrZero);
    final cumulative = cumulativeRoundScores(
      snapshot.myRounds,
      snapshot.entries,
      snapshot.candidates,
      snapshot.post.seats,
    );
    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          "COUNTING NOW",
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 1.6,
                            color: GeciColors.mutedForeground,
                          ),
                        ),
                        Text(
                          "Round $roundNumber",
                          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                                fontWeight: FontWeight.w700,
                              ),
                        ),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      const Text(
                        "BALLOTS",
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 1.6,
                          color: GeciColors.mutedForeground,
                        ),
                      ),
                      Text.rich(
                        TextSpan(
                          text: formatNumber(desk.committedTotal),
                          style: const TextStyle(
                            fontSize: 28,
                            fontWeight: FontWeight.w900,
                            color: GeciColors.emerald800,
                            height: 1,
                          ),
                          children: [
                            if (desk.roundCap > 0)
                              TextSpan(
                                text: " / ${formatNumber(desk.roundCap)}",
                                style: const TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                  color: GeciColors.mutedForeground,
                                ),
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                [
                  snapshot.election.name,
                  "${snapshot.election.countLimit} ballots per round",
                  if (snapshot.post.seats > 1) "${snapshot.post.seats} votes per ballot",
                  if (snapshot.post.votesPolled > 0) "${snapshot.post.votesPolled} polled",
                ].join(" · "),
                style: const TextStyle(color: GeciColors.mutedForeground, fontSize: 12),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  if (desk.waitingOnSupervisor)
                    const StatusBadge(
                      label: "Awaiting Returning Officer verification",
                      tone: BadgeTone.warning,
                    ),
                  if (desk.rejectedRound != null && !desk.waitingOnSupervisor)
                    const StatusBadge(label: "Rejected — re-enter this round", tone: BadgeTone.danger),
                  if (desk.isLastRound && !desk.waitingOnSupervisor && desk.rejectedRound == null)
                    const StatusBadge(label: "Last round", tone: BadgeTone.neutral),
                  if (desk.postComplete && desk.waitingOnSupervisor)
                    const StatusBadge(label: "All ballots in", tone: BadgeTone.success),
                ],
              ),
              if (desk.multiSeat && !desk.blocked && !desk.postComplete) ...[
                const SizedBox(height: 12),
                Container(
                  decoration: BoxDecoration(
                    color: theme.panel,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: theme.border),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      ColoredBox(color: theme.bar, child: const SizedBox(height: 6)),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: [
                                for (var slot = 0; slot < desk.marksPerBallot; slot += 1)
                                  _SlotChip(
                                    slot: slot,
                                    current: slot == desk.currentSlot,
                                    label: desk.labelForId(desk.draft[slot]),
                                    onTap: () => desk.selectSlot(slot),
                                  ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text(
                              desk.ballotReady
                                  ? "Vote on another candidate to replace the ${ordinalMark(desk.currentSlot)} mark. Vote on a marked candidate to change that mark instead."
                                  : "Select the ${ordinalMark(desk.currentSlot)} candidate${desk.fillingBallot ? " on this ballot" : " on the next ballot"}. Use Invalid ${ordinalMark(desk.currentSlot)} only if that mark is spoilt.",
                                  : "Select the ${ordinalMark(desk.currentSlot)} candidate${desk.fillingBallot ? " on this ballot" : " on the next ballot"}. Use Invalid ${ordinalMark(desk.currentSlot)} only if that mark is spoilt.",
                              style: TextStyle(
                                color: theme.text,
                                fontWeight: FontWeight.w600,
                                fontSize: 13,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 12),
              if (desk.rejectedRound?.remarks != null)
                Notice(
                  text: "Returning Officer remarks: ${desk.rejectedRound!.remarks}",
                  tone: BadgeTone.danger,
                ),
              if (!desk.countingOpen)
                const Padding(
                  padding: EdgeInsets.only(bottom: 8),
                  child: Notice(
                    text: "Counting is closed. Wait for the admin to open it.",
                    tone: BadgeTone.warning,
                  ),
                ),
              if (desk.postComplete && desk.waitingOnSupervisor)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Notice(
                    text:
                        "All ${formatNumber(desk.votesPolled)} ballots are in. Counting is done after Returning Officer verification.",
                    tone: BadgeTone.success,
                  ),
                ),
              Card(
                color: desk.multiSeat ? theme.panel : GeciColors.card,
                child: Column(
                  children: [
                    for (final row in desk.tableRows)
                      _CandidateRow(
                        row: row,
                        desk: desk,
                        onVote: () => _onVote(context, row.id),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Text(
                "Earlier rounds",
                style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
              ),
              if (snapshot.myRounds.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 12),
                  child: Text(
                    "No rounds submitted yet.",
                    style: TextStyle(color: GeciColors.mutedForeground),
                  ),
                )
              else
                ...snapshot.myRounds.map((round) {
                  return _RoundTile(
                    round: round,
                    snapshot: cumulative[round.id],
                    candidates: snapshot.candidates,
                    seats: snapshot.post.seats,
                  );
                }),
            ],
          ),
        ),
        Material(
          color: GeciColors.card,
          elevation: 8,
          child: SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (desk.error != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Text(desk.error!, style: const TextStyle(color: GeciColors.red700, fontSize: 13)),
                    ),
                  Text.rich(
                    TextSpan(
                      text: "Last vote: ",
                      style: const TextStyle(fontWeight: FontWeight.w500),
                      children: [
                        if (desk.multiSeat && desk.lastSlot != null && desk.lastVoteLabel != null)
                          WidgetSpan(
                            alignment: PlaceholderAlignment.middle,
                            child: Padding(
                              padding: const EdgeInsets.only(right: 6),
                              child: _SlotChip(
                                slot: desk.lastSlot!,
                                current: true,
                                label: null,
                                compact: true,
                              ),
                            ),
                          ),
                        TextSpan(
                          text: desk.lastVoteLabel ?? "—",
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                      ],
                    ),
                  ),
                  if (desk.pendingTotal > 0)
                    Text(
                      desk.multiSeat ? "1 ballot not confirmed yet" : "1 vote not confirmed yet",
                      style: const TextStyle(color: GeciColors.amber700, fontSize: 12, fontWeight: FontWeight.w600),
                    ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: FilledButton(
                          onPressed: desk.canConfirmQueued ? () => _onConfirm(context) : null,
                          style: FilledButton.styleFrom(
                            minimumSize: const Size.fromHeight(56),
                            backgroundColor: desk.roundFull && desk.canConfirmQueued
                                ? GeciColors.amber300
                                : GeciColors.primary,
                            foregroundColor: desk.roundFull && desk.canConfirmQueued
                                ? GeciColors.emerald950
                                : GeciColors.primaryForeground,
                          ),
                          child: const Text("Confirm"),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: FilledButton(
                          onPressed: desk.canSubmit ? () => _openSubmit(context) : null,
                          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(56)),
                          child: const Text("Review and submit"),
                        ),
                      ),
                    ],
                  ),
                  if (desk.pendingTotal > 0 || desk.fillingBallot)
                    TextButton(
                      onPressed: desk.clearQueued,
                      child: const Text("Clear vote"),
                    ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

extension on CountDeskController {
  int get activeSlotOrZero => currentSlot;
  String? get lastVoteLabel => labelForId(lastId);
}

class _SlotChip extends StatelessWidget {
  const _SlotChip({
    required this.slot,
    required this.current,
    this.label,
    this.compact = false,
    this.onTap,
  });

  final int slot;
  final bool current;
  final String? label;
  final bool compact;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = slotTheme(slot);
    final chip = Container(
      padding: EdgeInsets.symmetric(horizontal: compact ? 8 : 10, vertical: compact ? 4 : 6),
      decoration: BoxDecoration(
        color: current ? theme.chip : Colors.white.withValues(alpha: 0.8),
        borderRadius: BorderRadius.circular(99),
      ),
      child: Text(
        [
          ordinalMark(slot),
          if (label != null) label!,
          if (label == null && current && !compact) "now",
        ].join(" "),
        style: TextStyle(
          color: current ? theme.chipText : GeciColors.mutedForeground,
          fontSize: compact ? 10 : 12,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.4,
        ),
      ),
    );
    if (onTap == null) return chip;
    return GestureDetector(onTap: onTap, child: chip);
  }
}

class _CandidateRow extends StatelessWidget {
  const _CandidateRow({
    required this.row,
    required this.desk,
    required this.onVote,
  });

  final CountRow row;
  final CountDeskController desk;
  final VoidCallback onVote;

  @override
  Widget build(BuildContext context) {
    final isLast = row.id == desk.lastId;
    final invalidActive = row.invalid && isLast;
    final markedSlot = desk.slotOnBallot(row.id);
    final alreadyOnBallot = desk.multiSeat && markedSlot >= 0;
    final occupyingCurrent = alreadyOnBallot && markedSlot == desk.currentSlot;
    final last = desk.lastSlot != null ? slotTheme(desk.lastSlot!) : null;
    Color? bg;
    if (invalidActive || (occupyingCurrent && row.invalid)) {
      bg = GeciColors.red50;
    } else if (occupyingCurrent) {
      bg = Colors.white.withValues(alpha: 0.7);
    } else if (isLast && !row.invalid) {
      bg = last?.last;
    }
    final theme = alreadyOnBallot ? slotTheme(markedSlot) : slotTheme(desk.currentSlot);
    return Container(
      color: bg,
      padding: const EdgeInsets.fromLTRB(12, 10, 8, 10),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text.rich(
                  TextSpan(
                    text: row.name,
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      color: invalidActive ? GeciColors.red900 : GeciColors.emerald950,
                    ),
                    children: [
                      if (alreadyOnBallot)
                        WidgetSpan(
                          alignment: PlaceholderAlignment.middle,
                          child: Padding(
                            padding: const EdgeInsets.only(left: 6),
                            child: _SlotChip(
                              slot: markedSlot,
                              current: true,
                              label: null,
                              compact: true,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                Text(
                  [row.panel, row.classLabel].where((part) => part != null && part.isNotEmpty).join(" · "),
                  style: TextStyle(
                    fontSize: 12,
                    color: invalidActive ? GeciColors.red700 : GeciColors.mutedForeground,
                  ),
                ),
                if (desk.multiSeat && !row.invalid)
                  Text(
                    [
                      for (var slot = 0; slot < desk.marksPerBallot; slot += 1)
                        "${ordinalMark(slot)} ${formatNumber((desk.candidateSlots[row.id]?[slot] ?? 0) + (desk.pendingCandidateSlots[row.id]?[slot] ?? 0))}",
                    ].join(" · "),
                    style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: GeciColors.emerald700),
                  )
                else if (!desk.multiSeat && row.pending > 0)
                  const Text(
                    "+1 to confirm",
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: GeciColors.amber700),
                  ),
              ],
            ),
          ),
          Text(
            formatNumber(row.count),
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w900,
              color: invalidActive ? GeciColors.red700 : GeciColors.emerald800,
            ),
          ),
          const SizedBox(width: 8),
          FilledButton(
            onPressed: desk.voteDisabled(row) ? null : onVote,
            style: FilledButton.styleFrom(
              backgroundColor: row.invalid
                  ? GeciColors.destructive
                  : occupyingCurrent
                      ? Colors.white
                      : (desk.multiSeat ? theme.vote : GeciColors.primary),
              foregroundColor: occupyingCurrent && !row.invalid ? theme.chip : Colors.white,
              minimumSize: const Size(64, 36),
              padding: const EdgeInsets.symmetric(horizontal: 10),
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            child: Text(alreadyOnBallot ? ordinalMark(markedSlot) : "Vote"),
          ),
        ],
      ),
    );
  }
}

class _FinishedView extends StatelessWidget {
  const _FinishedView({required this.snapshot});

  final DeskSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    final result = snapshot.result;
    final ranked = rankByVotesThenName(
      [
        for (final candidate in snapshot.candidates)
          (
            candidate: candidate,
            votes: result?.entries
                    .where((entry) => entry.candidateId == candidate.id)
                    .map((entry) => entry.votes)
                    .firstOrNull ??
                0,
            slotVotes: result?.entries
                .where((entry) => entry.candidateId == candidate.id)
                .map((entry) => entry.slotVotes)
                .firstOrNull,
          ),
      ],
      (row) => row.votes,
      (row) => row.candidate.name,
    );
    final seats = resolveSeats(ranked, snapshot.post.seats, (row) => row.votes);
    final electedIds = {for (final row in seats.elected) row.candidate.id};
    final tiedIds = {for (final row in seats.tied) row.candidate.id};
    final invalidTotal = result?.invalid ?? 0;
    final candidateVotes = ranked.fold(0, (sum, row) => sum + row.votes);
    final multi = snapshot.post.seats > 1;
    final invalidSlots =
        result != null && result.invalidSlots.length > 1 ? result.invalidSlots : null;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
      children: [
        const Text(
          "COUNTING DONE",
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            letterSpacing: 1.6,
            color: GeciColors.emerald700,
          ),
        ),
        Row(
          children: [
            Expanded(
              child: Text(
                "Results · ${snapshot.post.name}",
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700),
              ),
            ),
            const StatusBadge(label: "Done", tone: BadgeTone.success),
          ],
        ),
        const SizedBox(height: 10),
        Notice(
          text:
              "All ${formatNumber(snapshot.post.votesPolled)} ballots have been counted. No further rounds are needed.${seats.tied.isNotEmpty ? " ${seats.tied.length} candidates are tied for the remaining seat${snapshot.post.seats - seats.elected.length == 1 ? "" : "s"}." : ""}",
          tone: BadgeTone.success,
        ),
        const SizedBox(height: 12),
        Card(
          child: Column(
            children: [
              for (var index = 0; index < ranked.length; index += 1)
                Builder(
                  builder: (context) {
                    final row = ranked[index];
                    final elected = electedIds.contains(row.candidate.id);
                    final tied = tiedIds.contains(row.candidate.id);
                    final rank = competitionRank(ranked, index, (item) => item.votes);
                    final share = percent(row.votes, candidateVotes + invalidTotal);
                    return Container(
                      color: elected
                          ? GeciColors.amber50
                          : tied
                              ? GeciColors.sky50
                              : null,
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      child: Row(
                        children: [
                          Container(
                            width: 28,
                            height: 28,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: elected
                                  ? GeciColors.amber300
                                  : tied
                                      ? GeciColors.sky200
                                      : GeciColors.emerald100,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              "$rank",
                              style: TextStyle(
                                fontWeight: FontWeight.w800,
                                color: elected
                                    ? GeciColors.emerald950
                                    : tied
                                        ? GeciColors.sky950
                                        : GeciColors.emerald800,
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Wrap(
                                  spacing: 6,
                                  crossAxisAlignment: WrapCrossAlignment.center,
                                  children: [
                                    Text(row.candidate.name, style: const TextStyle(fontWeight: FontWeight.w700)),
                                    if (elected) const StatusBadge(label: "ELECTED", tone: BadgeTone.gold),
                                    if (tied) const StatusBadge(label: "TIE", tone: BadgeTone.sky),
                                  ],
                                ),
                                Text(
                                  [
                                    row.candidate.panelName,
                                    candidateClassLabel(
                                      row.candidate.branch,
                                      row.candidate.year,
                                      row.candidate.semester,
                                    ),
                                  ].where((part) => part.isNotEmpty).join(" · "),
                                  style: const TextStyle(fontSize: 12, color: GeciColors.mutedForeground),
                                ),
                              ],
                            ),
                          ),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(
                                formatNumber(row.votes),
                                style: TextStyle(
                                  fontSize: 22,
                                  fontWeight: FontWeight.w900,
                                  color: elected
                                      ? GeciColors.amber700
                                      : tied
                                          ? GeciColors.sky800
                                          : GeciColors.emerald800,
                                ),
                              ),
                              Text(
                                multi && (row.slotVotes?.length ?? 0) > 1
                                    ? [
                                        for (var slot = 0; slot < row.slotVotes!.length; slot += 1)
                                          "${ordinalMark(slot)} ${formatNumber(row.slotVotes![slot])}",
                                      ].join(" · ")
                                    : "$share% share",
                                style: const TextStyle(fontSize: 10, color: GeciColors.emerald600),
                              ),
                            ],
                          ),
                        ],
                      ),
                    );
                  },
                ),
              if (invalidSlots != null)
                for (var slot = 0; slot < invalidSlots.length; slot += 1)
                  _InvalidTotal(label: "Invalid ${ordinalMark(slot)}", votes: invalidSlots[slot])
              else
                _InvalidTotal(label: "Invalid", votes: invalidTotal),
            ],
          ),
        ),
      ],
    );
  }
}

class _InvalidTotal extends StatelessWidget {
  const _InvalidTotal({required this.label, required this.votes});

  final String label;
  final int votes;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: GeciColors.red50,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Row(
        children: [
          Text(label, style: const TextStyle(fontWeight: FontWeight.w700, color: GeciColors.red900)),
          const Spacer(),
          Text(
            formatNumber(votes),
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: GeciColors.red700),
          ),
        ],
      ),
    );
  }
}

class _RoundTile extends StatelessWidget {
  const _RoundTile({
    required this.round,
    required this.snapshot,
    required this.candidates,
    required this.seats,
  });

  final CountRound round;
  final CountResult? snapshot;
  final List<Candidate> candidates;
  final int seats;

  @override
  Widget build(BuildContext context) {
    final names = {for (final candidate in candidates) candidate.id: candidate.name};
    final entries = snapshot?.entries ?? const [];
    final invalid = snapshot?.invalid ?? round.invalidVotes;
    final slots = snapshot != null && snapshot!.invalidSlots.length > 1
        ? snapshot!.invalidSlots
        : null;
    final totalMarks = entries.fold(0, (sum, entry) => sum + entry.votes) + invalid;
    final status = switch (round.status) {
      "rejected" => (label: "Rejected", color: GeciColors.red700),
      "pending_verification" => (label: "Pending", color: GeciColors.amber700),
      _ => (label: "Verified", color: GeciColors.mutedForeground),
    };
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text.rich(
                  TextSpan(
                    text: "Round ${round.roundNumber}  ",
                    style: const TextStyle(fontWeight: FontWeight.w600),
                    children: [
                      TextSpan(
                        text: status.label,
                        style: TextStyle(fontWeight: FontWeight.w500, color: status.color, fontSize: 12),
                      ),
                    ],
                  ),
                ),
                Text(
                  [
                    ...entries.map((entry) => "${names[entry.candidateId] ?? "Candidate"} ${formatNumber(entry.votes)}"),
                    if (slots != null)
                      ...[
                        for (var slot = 0; slot < slots.length; slot += 1)
                          "Invalid ${ordinalMark(slot)} ${formatNumber(slots[slot])}",
                      ]
                    else
                      "Invalid ${formatNumber(invalid)}",
                  ].join(" · "),
                  style: const TextStyle(fontSize: 12, color: GeciColors.mutedForeground),
                ),
              ],
            ),
          ),
          Text(
            formatNumber(marksToBallots(totalMarks, seats)),
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}
