# Brief: sabbatical allocation calculator

## Problem

A university allocates a fixed number of sabbatical leaves ("seats") each year across its colleges. The allocation must be proportional to each college's number of eligible faculty and must account for the fact that a college cannot use more seats than it has applicants. A committee needs a tool that computes the allocation from the inputs, presents the result, and lets committee members verify how the result was reached.

## Users and environment

- Committee members and administrators. Non-technical. Some use Windows, some use macOS.
- They must receive a single platform-independent deliverable that they can launch without installing anything and without administrator rights.
- The tool must not send data anywhere.

You choose the language, technology, and architecture. Justify the choice in a short document alongside the code.

## Inputs

- The number of colleges is not fixed. The user must be able to specify how many colleges there are and enter a name for each.
- For each college: number of eligible faculty (whole number ≥ 0) and number of applicants (whole number ≥ 0, cannot exceed eligible faculty).
- The number of seats available is 12% of the total eligible faculty across all colleges. State how you turn this into a whole number, and make the choice visible to the user.

## Allocation rules (institutional policy; do not alter)

1. Seats are divided among colleges in proportion to eligible faculty using the Hamilton method (largest remainder): each college receives the whole-number part of its exact proportional quota, and any seats left over go one each to the colleges with the largest fractional parts. Specify and document how ties in fractional parts are resolved.
2. The allocation proceeds in rounds.
   - In the first round, every college takes part, including colleges with zero applicants, and the pool is the full number of seats available.
   - After each round, each college's allocation is compared with its applicants not yet funded. Seats a college cannot use are returned to the pool. A college with no unfunded applicants is settled.
   - Each later round divides the returned seats, by the same method, among only the colleges that still have unfunded applicants. Settled colleges do not take part.
   - The process ends when there are no seats left to distribute or no college has unfunded applicants. If seats remain at the end, they are reported as unallocated.

## Output

- The output must be very informative and easy to understand for a non-technical reader.
- It must allow the user to verify and validate what took place in computing the result, at the level of individual arithmetic steps if they wish.
- Invalid or inconsistent inputs must be reported clearly.

## Deliverables

- The launchable artifact.
- Source code and any build or test instructions.
- A short document explaining the technology choice, the structure of the code, and any decisions you made that the policy above leaves open.
