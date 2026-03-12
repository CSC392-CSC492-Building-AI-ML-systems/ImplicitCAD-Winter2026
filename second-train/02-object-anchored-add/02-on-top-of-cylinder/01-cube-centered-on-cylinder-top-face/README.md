# Cube Centered on Cylinder Top Face Test

## Description
This test validates the model's ability to place a cube on top of a cylinder with center alignment, testing the inverse cross-primitive positioning scenario.

## Task
- Start with a base cylinder at origin [0,0,0] with height 4 and radius 2
- Add a cube with dimensions [3,3,3] positioned so its center aligns with the center of the cylinder's top face
- The cylinder's top center is at [0,0,4], so the cube should be at position [-1.5,-1.5,4]
- The cube's center will be at [0,0,5.5] when positioned correctly

## Key Learning Points
- Cross-primitive geometric relationships (cylinder + cube)
- Understanding different primitive coordinate systems (cylindrical vs rectangular)
- Center-based positioning across different geometries
- Circular face center calculation for cube placement
- Offset calculation: cube position = face_center - [cube_size/2, cube_size/2, 0]

## Expected Result
A cylinder with a cube balanced on its circular top face, with the cube perfectly centered over the cylinder's axis.
