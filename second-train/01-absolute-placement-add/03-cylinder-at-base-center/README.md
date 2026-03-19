# Cylinder Base-Center Absolute Placement Tests

## Description
This group focuses on absolute cylinder placement tasks using base-center coordinates. The model must place cylinders and tapered cylinders at exact coordinates.

## Included Tests
- `01-cylinder-r-h-base-center-xyz`: standard cylinder with explicit `r`, `h`, and base center coordinates
- `02-tapered-cylinder-r1-r2-h-base-center-xyz`: tapered cylinder with explicit `r1`, `r2`, `h`, and base center coordinates
- `03-elliptical-cylinder-rx-ry-h`: scaled cylinder variant
- `04-tall-thin-cylinder`: tall narrow cylinder placement case
- `05-cylinder-float-r-h-base-center-xyz`: cylinder placement using floating-point values
- `06-tapered-cylinder-float-r1-r2-h-base-center-xyz`: tapered cylinder placement using floating-point values

## Key Learning Points
- Base-center semantics for `cylinder(..., center=false)`
- Distinction between regular and tapered cylinder parameterization
- Axis-aligned placement with explicit z-origin for height extrusion
- Proper handling of non-uniform radius tapers
- Maintaining precision for floating-point radii, heights, and base-center coordinates

## Validation Structure
Each test includes:
- **llm-input/**: problem files
  - `prompt.txt`: natural language task description
  - `model.scad`: initial scene with existing geometry
- **expected/**: reference solution with validation artifacts
  - `expected-scad.txt`: final scene with new cylinder(s) added
  - `initial.stl`: binary 3D mesh of the initial model
  - `expected.stl`: binary 3D mesh of the completed model
  - `initial-sdf`: symbolic description (resolution + union expression)
  - `expected-sdf`: symbolic description of expected result

## Expected Result
Each test should add exactly one cylinder primitive at the requested base-center position and dimensions, including floating-point parameter cases.
