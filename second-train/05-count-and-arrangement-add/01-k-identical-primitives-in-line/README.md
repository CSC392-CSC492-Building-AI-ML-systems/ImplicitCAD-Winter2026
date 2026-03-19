# K Identical Primitives In Line

## Description
These tasks focus on completing lines of repeated primitives with fixed spacing. The missing object may be at an endpoint, in the middle of the line, or on a diagonal.

## Included Tests
- Repeated cubes, spheres, cylinders, cones, and tapered cylinders
- Positive, negative, and diagonal coordinate layouts
- Endpoint and interior completion cases
- Floating-point step sizes and floating-point object coordinates

## Key Learning Points
- Recovering a constant step from existing geometry
- Preserving primitive parameters while repeating them
- Completing a line without changing the original scene
- Preserving floating-point spacing precisely across a 1D arrangement

## Validation Structure
Each task includes `prompt.txt`, `model.scad`, `expected-scad.txt`, STL renders, SDF captures, admesh placeholders, and a leaf README.

## Expected Result
Each completed scene forms the requested line with the correct number of identical primitives.
