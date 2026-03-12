# Cylinder Centered on Cube Top Face Test

## Description
This test validates the model's ability to place a cylinder on top of a cube with center alignment, testing cross-primitive positioning.

## Task
- Start with a base cube at origin [0,0,0] with size [4,4,4]
- Add a cylinder with radius 1 and height 3 positioned so its base center aligns with the center of the cube's top face
- The cylinder should be at position [2,2,4] (center of cube's top face)
- The cube's top face spans from [0,0,4] to [4,4,4], so its center is at [2,2,4]

## Key Learning Points
- Cross-primitive geometric relationships (cube + cylinder)
- Understanding different primitive parameters (cube: size vs cylinder: radius, height)
- Center-based positioning across different geometries
- Face center calculation for positioning

## Expected Result
A cube with a cylinder standing on its top face, with the cylinder perfectly centered on the square face.
