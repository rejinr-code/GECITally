import "package:flutter_test/flutter_test.dart";
import "package:geci_tally/count_desk.dart";
import "package:geci_tally/counting_math.dart";
import "package:geci_tally/models.dart";

Candidate candidate(String id, String name) {
  return Candidate(
    id: id,
    name: name,
    panelName: "Independent",
    displayOrder: 0,
  );
}

void main() {
  test("Indian grouping and ballot conversion", () {
    expect(formatNumber(1234567), "12,34,567");
    expect(marksToBallots(10, 1), 10);
    expect(marksToBallots(10, 2), 5);
    expect(ordinalMark(0), "1st");
    expect(ordinalMark(1), "2nd");
  });

  test("single-seat Vote then Confirm", () {
    final desk = CountDeskController(
      candidates: [candidate("a", "Anu"), candidate("b", "Binu")],
      seats: 1,
      roundSize: 3,
      votesPolled: 10,
      countedBallots: 0,
      countingOpen: true,
      requireSupervisor: true,
    );
    desk.queueVote("a");
    expect(desk.pendingTotal, 1);
    expect(desk.votes["a"], 0);
    expect(desk.canConfirmQueued, isTrue);
    desk.confirmQueued();
    expect(desk.votes["a"], 1);
    expect(desk.committedTotal, 1);
    expect(desk.pendingTotal, 0);
    desk.dispose();
  });

  test("multi-seat ballot must confirm before the next paper", () {
    final desk = CountDeskController(
      candidates: [
        candidate("a", "Anu"),
        candidate("b", "Binu"),
        candidate("c", "Chitra"),
      ],
      seats: 2,
      roundSize: 5,
      votesPolled: 20,
      countedBallots: 0,
      countingOpen: true,
      requireSupervisor: true,
    );
    desk.queueVote("a");
    desk.queueVote("a");
    expect(desk.error, "This candidate is already marked on this ballot.");
    desk.queueVote("b");
    expect(desk.pendingTotal, 1);
    expect(desk.fillingBallot, isFalse);
    desk.queueVote("c");
    expect(desk.error, "Confirm this ballot first.");
    desk.confirmQueued();
    expect(desk.votes["a"], 1);
    expect(desk.votes["b"], 1);
    expect(desk.committedTotal, 1);
    desk.dispose();
  });
}
