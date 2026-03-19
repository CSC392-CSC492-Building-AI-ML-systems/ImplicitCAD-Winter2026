# Sphere Absolute Placement Tests

## Description
This group focuses on absolute sphere placement tasks. The model must place spheres at exact center coordinates with specified radii.

## Included Tests
- `01-sphere-r-at-xyz`: place a sphere using radius and center coordinates
- `02-sphere-large-radius`: place a sphere with a larger radius
- `03-sphere-small-radius`: place a sphere with a smaller radius
- `04-sphere-negative-coords`: place a sphere at negative coordinates
- `05-sphere-float-r-at-xyz`: place a sphere using floating-point radius and center coordinates
- `06-sphere-float-negative-center`: place a sphere at negative floating-point coordinates

## Key Learning Points
- Direct center-based sphere placement (no conversion needed)
- Correct radius specification in ImplicitCAD syntax
- Preserving existing scene geometry while adding one new sphere
- Maintaining floating-point precision for sphere centers and radii

## Validation Structure
Each test includes:
- **llm-input/**: problem files
  - `prompt.txt`: natural language task description
  - `model.scad`: initial scene with existing geometry
- **expected/**: reference solution with validation artifacts
  - `expected-scad.txt`: final scene with new sphere added
  - `initial.stl`: binary 3D mesh of the initial model
  - `expected.stl`: binary 3D mesh of the completed model
  - `initial-sdf`: symbolic description (resolution + union expression)
  - `expected-sdf`: symbolic description of expected result

## Expected Result
Each test should produce a final model with a sphere placed at the requested center and radius, including floating-point variants.
