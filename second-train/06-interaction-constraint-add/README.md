# Interaction Constraint Add

## Description
This section validates whether a model can add one new primitive while satisfying interaction constraints with existing geometry.

## Scope
- Enforce touching without overlap
- Enforce disjoint placement with explicit gap values
- Bridge disconnected components with a connector object
- Place a new object between two existing objects with bilateral constraints

## Subtasks
- `01-touch-without-overlap`: 5 cases (3 simple + 2 complex decimal/off-origin)
- `02-disjoint-with-gap`: 5 cases (3 simple + 2 complex decimal/off-origin)
- `03-bridge-two-components`: 5 cases (3 simple + 2 complex decimal/off-origin)
- `04-between-two-objects`: 5 cases (3 simple + 2 complex decimal/off-origin)

## Expected Result
A complete 20-case interaction-constraint set matching the section-02 pattern: four themes with five cases each, including complex decimal/off-origin coverage.
