# K Primitives In Grid

## Description
These tasks evaluate whether a model can complete 2D arrangements such as full rectangular grids and parity-based checkerboards.

## Included Tests
- Cube, sphere, cylinder, and cone grids
- Positive and negative coordinate systems
- Interior, edge, and corner completion cases
- Floating-point row spacing, column spacing, and checkerboard coordinates

## Key Learning Points
- Inferring row and column spacing from partial evidence
- Respecting both count constraints and spatial layout
- Completing structured 2D arrangements without disturbing existing cells
- Maintaining precise floating-point grid spacing and parity-based placement

## Validation Structure
Each task includes `prompt.txt`, `model.scad`, `expected-scad.txt`, STL renders, SDF captures, admesh placeholders, and a leaf README.

## Expected Result
Each completed scene forms the requested grid or checkerboard with the correct missing cell restored.
