# Sphere with Gap Along Y from Offset Sphere Test

## Description
This test validates beside-object spacing along the y-axis, extending beyond the common x-axis gap pattern.

## Task
- Start with a target sphere centered at [-1.75,2.4,0.5] with radius 1.3
- Add a second sphere of radius 0.9
- Place the second sphere in +y with a 0.55 unit gap between surfaces
- Center distance in y is 1.3 + 0.55 + 0.9 = 2.75
- The new sphere center should be at [-1.75,5.15,0.5]

## Key Learning Points
- Beside-object placement on y-axis instead of x-axis
- Gap computation between different sphere radii
- Decimal coordinates and offsets in all axes

## Expected Result
Two offset spheres separated along y with exactly 0.55 units between their surfaces.
