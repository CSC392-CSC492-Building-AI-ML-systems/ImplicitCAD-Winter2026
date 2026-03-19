# Sphere Absolute Placement Tests

## Description
This group focuses on absolute sphere placement tasks. The model must place spheres at exact center coordinates with specified radii.

## Included Tests
- `01-sphere-r-at-xyz`: place a sphere using radius and center coordinates

## Key Learning Points
- Direct center-based sphere placement (no conversion needed)
- Correct radius specification in ImplicitCAD syntax
- Preserving existing scene geometry while adding one new sphere

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
Each test should produce a final model with a sphere placed at the requested center and radius.
