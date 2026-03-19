# Absolute Placement Add

## Description
This section validates whether a model can add new primitives using explicit world coordinates, without relying on relative placement to existing objects.

## Scope
- Add one new primitive at a specified absolute location
- Preserve all existing geometry in the input scene
- Handle both corner-based and center-based placement conventions

## Subtasks
- `01-cube-at-origin`: cube placement from corner and center specifications
- `02-sphere-at-center`: sphere placement by radius and center point
- `03-cylinder-at-base-center`: cylinder and tapered cylinder placement by base-center coordinates

## Key Learning Points
- Distinguishing absolute coordinates from object-anchored coordinates
- Correct interpretation of primitive parameter conventions in ImplicitCAD
- Stable translation math for center-to-corner conversion when needed

## Validation Structure
Following section 03's validation approach, each test includes:
- **llm-input/**: problem description and initial model
  - `prompt.txt`: natural language task specification
  - `model.scad`: initial scene with existing geometry
- **expected/**: reference solution with validation artifacts
  - `expected-scad.txt`: final scene with new primitive added
  - `initial.stl`: binary 3D mesh of the initial model
  - `expected.stl`: binary 3D mesh of the completed model
  - `initial-sdf`: symbolic description (resolution + union expression + ghc stats)
  - `expected-sdf`: symbolic description of expected result
  - `initial-admesh`: mesh analysis of initial model
  - `expected-admesh`: mesh analysis of expected result
- **README.md**: problem description and validation guidance (leaf-level tasks only)

## Expected Result
A complete set of absolute-placement training cases with validation artifacts (STL, SDF, admesh) following section 03's structure.
