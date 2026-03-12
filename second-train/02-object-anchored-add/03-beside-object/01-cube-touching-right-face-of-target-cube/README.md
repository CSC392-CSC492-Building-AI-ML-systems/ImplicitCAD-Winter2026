# Cube Touching Right Face of Target Cube Test

## Description
This test validates the model's ability to position a cube adjacent to another cube with perfect face-to-face contact, testing lateral positioning concepts.

## Task
- Start with a target cube at origin [0,0,0] with size [4,4,4]
- Add a second cube positioned to touch the right face of the target cube
- The target cube's right face spans from x=4, so the new cube should be at position [4,0,0]
- Both cubes should share the same y,z coordinates but be offset in x

## Key Learning Points
- Lateral positioning vs vertical stacking
- Face-to-face contact between same primitives
- Understanding cube face boundaries and adjacency
- Calculating adjacent positions: new_x = target_x + target_width
- Spatial reasoning about "right" direction in 3D coordinate system

## Expected Result
Two cubes positioned side by side, sharing a common face along the x-axis, creating a rectangular block twice as wide as the original cube.
