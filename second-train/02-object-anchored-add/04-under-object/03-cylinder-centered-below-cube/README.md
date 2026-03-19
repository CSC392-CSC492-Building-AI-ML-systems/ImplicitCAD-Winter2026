# Cylinder Centered Below Cube Test

## Description
This test validates the model's ability to place a cylinder directly below an existing cube while keeping center alignment in x and y.

## Task
- Start with a target cube at origin [0,0,0] with size [6,6,6]
- Add a cylinder with radius 1.5 and height 4 below the cube
- Center the cylinder under the cube in x and y
- Make the cylinder top face touch the cube's bottom face
- The cylinder base should be at z=-4, so position it at [3,3,-4]

## Key Learning Points
- Center alignment between different primitive types
- Below-object placement with exact face contact
- Coordinate calculation from cube footprint center and cylinder height

## Expected Result
A cube with a centered supporting cylinder directly below it, touching at the interface plane z=0.
