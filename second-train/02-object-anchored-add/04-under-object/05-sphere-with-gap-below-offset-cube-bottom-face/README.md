# Sphere with Gap Below Offset Cube Bottom Face Test

## Description
This test validates controlled under-object spacing below a cube bottom face with decimal gap and center anchoring.

## Task
- Start with a cube at [-5.0,1.75,2.6] with size [3.4,2.8,1.6]
- Add a sphere of radius 1.05 below the cube
- Keep the sphere centered to the cube in x and y
- Keep a 0.4 unit gap between sphere surface and cube bottom face
- Cube bottom is z=2.6, so sphere center z is 2.6 - 0.4 - 1.05 = 1.15
- Sphere center should be at [-3.3,3.15,1.15]

## Key Learning Points
- Under-object gap constraints (not touching)
- Cube-center anchoring for non-cubic dimensions
- Decimal arithmetic with offset and negative/positive axes

## Expected Result
A sphere centered below an offset cube with exactly 0.4 units of space to the cube bottom face.
