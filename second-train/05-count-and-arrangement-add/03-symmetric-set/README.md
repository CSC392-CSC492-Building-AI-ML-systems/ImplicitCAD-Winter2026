# Symmetric Set

## Description
These tasks focus on adding mirrored objects so that the final scene satisfies one-axis or two-axis symmetry.

## Included Tests
- Mirror pairs across x=0 or y=0
- Four-quadrant and rectangular symmetric layouts
- Cube, sphere, and cylinder symmetry cases
- Floating-point mirror coordinates and floating-point rectangular symmetry layouts

## Key Learning Points
- Reflecting coordinates correctly across symmetry axes
- Preserving primitive parameters while creating mirrored counterparts
- Completing partial symmetric arrangements with minimal additions
- Maintaining exact symmetry when coordinates use floating-point values

## Validation Structure
Each task includes `prompt.txt`, `model.scad`, `expected-scad.txt`, STL renders, SDF captures, admesh placeholders, and a leaf README.

## Expected Result
Each completed scene satisfies the requested symmetry rule and object count.
