# Task (User Language)
The object is a 4x4 single-layer grid of unit cubes, with exactly one missing cube.
Add the missing cube.

## Exact Axis Data
- Missing cube base corner: `x = 3, y = 3, z = 0`
- Missing cube size: `dx = 1, dy = 1, dz = 1`

## Output Requirement
- Return only the SCAD snippet for the new object.

## Metric-Based Validation
- Do not require exact-match SCAD with any canonical answer.
- Evaluate only by comparing post-union SDF/ADMesh metrics against `expected/` target metrics.
