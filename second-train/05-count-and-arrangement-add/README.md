# Count And Arrangement Add

## Description
This section evaluates whether a model can add one or more primitives to satisfy explicit count and arrangement constraints.

## Scope
- Complete repeated arrangements along lines, grids, and symmetric layouts
- Preserve all existing geometry already present in the input scene
- Add only the missing primitives needed to satisfy the requested count rule

## Subtasks
- `01-k-identical-primitives-in-line`: repeated objects placed along a line or diagonal with fixed spacing
- `02-k-primitives-in-grid`: repeated objects arranged on rectangular grids or parity-constrained grids
- `03-symmetric-set`: mirrored object sets across one or both axes

## Key Learning Points
- Counting how many objects are missing from a partially completed arrangement
- Preserving constant step sizes in 1D and 2D layouts
- Respecting bilateral and quadrant symmetry while adding geometry
- Handling floating-point coordinates and spacing without drifting from the intended pattern

## Validation Structure
Following the complete validation pattern used in section 03, each leaf task includes:
- `llm-input/prompt.txt`: natural-language task specification
- `llm-input/model.scad`: initial incomplete scene
- `expected/expected-scad.txt`: completed reference scene
- `expected/initial.stl` and `expected/expected.stl`: rendered meshes
- `expected/initial-sdf` and `expected/expected-sdf`: symbolic scene descriptions
- `expected/initial-admesh` and `expected/expected-admesh`: mesh-analysis placeholders
- `README.md`: task-level description

## Expected Result
A complete set of 30 count-and-arrangement tasks, including integer and floating-point layout variants, with rendered validation artifacts ready for training and evaluation workflows.
