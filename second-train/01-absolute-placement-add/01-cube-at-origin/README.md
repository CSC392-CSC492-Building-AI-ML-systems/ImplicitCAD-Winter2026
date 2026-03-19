# Cube Absolute Placement Tests

## Description
This group focuses on absolute cube placement tasks. The model must place cubes at exact coordinates based on explicit numeric constraints.

## Included Tests
- `01-cube-corner-xyz-size`: place a cube using corner position plus size
- `02-cube-centered-xyz-size`: place a cube using center position plus size

## Key Learning Points
- Understanding `center=false` corner semantics for cubes
- Converting center-based cube specifications to translation coordinates
- Preserving existing scene geometry while adding one new primitive

## Validation Structure
Each test includes:
- **llm-input/**: problem files
  - `prompt.txt`: natural language task description
  - `model.scad`: initial scene with existing geometry
- **expected/**: reference solution with validation artifacts
  - `expected-scad.txt`: final scene with new cube added
  - `initial.stl`: binary 3D mesh of the initial model
  - `expected.stl`: binary 3D mesh of the completed model
  - `initial-sdf`: symbolic description (resolution + union expression)
  - `expected-sdf`: symbolic description of expected result

## Expected Result
Each test should produce a final model that exactly matches the requested cube location and dimensions.
