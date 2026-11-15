---
title: Choosing an underwater acoustic modem
client: Independent client
role: Embedded systems research engineer
when: August 2025
where: Spain
summary: I tested commercial underwater communication systems and wrote the comparison that picked the vendor.
order: 3
highlights:
  - Tested commercial acoustic modems against real conditions
  - Wrote the test methods for signal, environment and reliability
  - Feasibility and cost comparison that picked the vendor
stack: [Embedded systems, Test methodology, Cost analysis]
visual: sonar
related: []
---

## The brief

The client needed to move data underwater. Radio does not reach more than a few metres below the surface, so underwater links run on sound, and commercial acoustic modems vary a lot in range, data rate, sensitivity to the environment and price. A datasheet gives numbers measured under ideal conditions, not how a unit behaves in the water it will actually work in. The real question was not which modem looked best on paper, but which one would hold up in the client's operating conditions at a cost that made sense.

## What I did

- **Turned the requirement into a yardstick.** Before comparing anything, I pinned down what the integration actually needed: the operating conditions the link had to survive, the ranges involved, and the reliability the application could tolerate. That turned an open-ended "which modem is best" into a question with a measurable answer.
- **Wrote the test methodology.** I designed structured procedures to characterise each candidate system: how its signal behaves, how sensitive it is to the environment, and how reliably it delivers data across different configurations. Writing the methods down first meant every system got tested the same way, so results could be compared fairly instead of anecdotally.
- **Ran the comparison.** I evaluated the commercial systems against the yardstick and pulled the findings into a feasibility and cost comparison: what each modem could do, under which conditions, and what that performance cost.
- **Made it a decision.** The comparison drove the vendor choice and shaped the deployment plan, so the client could order hardware and schedule the integration knowing the pick stood on measured behaviour.

## How it went

This was as much a purchasing decision as a technical one. A modem that tops a datasheet can still lose to a cheaper unit that performs well enough where it counts, so the comparison put cost next to range and reliability rather than ranking on performance alone. The client ended up with a chosen vendor, a documented reason for the choice, and a deployment plan built on the measurements instead of marketing claims.
