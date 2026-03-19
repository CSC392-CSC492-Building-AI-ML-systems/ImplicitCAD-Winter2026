# Sphere Tangent Below Cylinder Base Face Test

## Description
This test validates the model's ability to place a sphere below a cylinder so that the sphere is tangent to the cylinder's base face.

## Task
- Start with a target cylinder at origin [0,0,0] with radius 2 and height 5
- Add a sphere of radius 1.5 below the cylinder
- The sphere must be tangent to the cylinder's base face at exactly one point
- Since the cylinder base plane is at z=0, the sphere center should be at [0,0,-1.5]

## Key Learning Points
- Tangency constraints between dissimilar primitives
- Object-anchored placement relative to a base face
- Correct z-offset using radius for precise contact

## Expected Result
A cylinder with a sphere directly underneath it, touching at one point where the sphere's top meets the cylinder's base plane.
