# Cube Touching Bottom Face of Target Cube Test

## Description
This test validates the model's ability to place a cube directly below an existing cube with exact face-to-face contact.

## Task
- Start with a target cube at origin [0,0,0] with size [4,4,4]
- Add a second cube with the same size [4,4,4] below the target cube
- The top face of the new cube must touch the bottom face of the target cube
- The new cube should be at position [0,0,-4]

## Key Learning Points
- Object-anchored vertical placement below a reference object
- Face-to-face contact constraints in the negative z direction
- Reusing existing object dimensions for aligned placement

## Expected Result
Two cubes stacked along the z-axis with exact contact at z=0, where the new cube is directly beneath the original cube.
