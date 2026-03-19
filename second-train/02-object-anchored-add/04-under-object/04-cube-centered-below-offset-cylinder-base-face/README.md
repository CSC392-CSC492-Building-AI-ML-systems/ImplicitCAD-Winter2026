# Cube Centered Below Offset Cylinder Base Face Test

## Description
This test validates placing a cube under a cylinder with exact top-to-base face contact at decimal offset coordinates.

## Task
- Start with a cylinder at [3.4,-2.2,1.1] with radius 1.4 and height 5.6
- Add a cube of size [2.0,2.0,2.0] below the cylinder
- Center the cube under the cylinder base in x and y
- The cube top face should touch the cylinder base plane at z=1.1
- The new cube should be translated to [2.4,-3.2,-0.9]

## Key Learning Points
- Under-object anchoring from cylinder base plane
- Centering a box below a circular footprint
- Decimal offsets and negative z placement

## Expected Result
An offset cylinder with a cube centered directly beneath its base and touching at z=1.1.
