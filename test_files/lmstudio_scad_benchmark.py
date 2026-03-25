#!/usr/bin/env python3
"""
Run 30 selected OpenSCAD benchmark prompts against a locally running LM Studio server
and save all outputs plus summary metrics to a TXT file.

Default assumptions:
- LM Studio local server is running on http://localhost:12345/v1
- OpenAI-compatible API is enabled
- The loaded model identifier is qwen3.5-9b-openscad_gguf

Usage:
    python lmstudio_scad_benchmark.py

Optional overrides:
    python lmstudio_scad_benchmark.py --base-url http://localhost:12345/v1 --model qwen3.5-9b-openscad_gguf
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path

try:
    from openai import OpenAI
except ImportError:
    print("Missing dependency: openai\nInstall with: pip install openai")
    raise

SELECTED_CASES = [
  {
    "dataset_index": 0,
    "prompt": "Task: Modify the OpenSCAD program according to the instruction.\n\nReturn the full updated OpenSCAD code.\nDo not explain anything.\n\nInstruction:\nAdd one cube at an absolute world coordinate. Keep all existing geometry unchanged. The new cube must use corner placement (center=false), have size [4,5,6], and corner origin exactly at [0,0,0].\n\nExisting OpenSCAD:\n```scad\nunion() {\n  translate([10, 0, 0]) sphere(r=1.2);\n}\n```",
    "expected": "union() {\n  translate([10, 0, 0]) sphere(r=1.2);\n  translate([0, 0, 0]) cube(size=[4,5,6], center=false);\n}"
  },
  {
    "dataset_index": 6,
    "prompt": "Task: Modify the OpenSCAD program according to the instruction.\n\nReturn the full updated OpenSCAD code.\nDo not explain anything.\n\nInstruction:\nAdd a cube specified by floating-point center coordinates and floating-point size. Keep the existing geometry unchanged. Add one cube centered at [4.5,1.75,2.25] with size [1.5,2.5,3.5].\n\nExisting OpenSCAD:\n```scad\nunion() {\n  translate([-3.25, 2.0, 0.0]) cylinder(r=0.9, h=3.2);\n}\n```",
    "expected": "union() {\n  translate([-3.25, 2.0, 0.0]) cylinder(r=0.9, h=3.2);\n  translate([3.75, 0.5, 0.5]) cube(size=[1.5,2.5,3.5], center=false);\n}"
  },
  {
    "dataset_index": 11,
    "prompt": "Task: Modify the OpenSCAD program according to the instruction.\n\nReturn the full updated OpenSCAD code.\nDo not explain anything.\n\nInstruction:\nAdd a sphere with floating-point center coordinates and floating-point radius. Keep the existing geometry unchanged. Add one sphere centered at [2.75,-1.5,3.25] with radius 1.875.\n\nExisting OpenSCAD:\n```scad\nunion() {\n  translate([0.5, 0.5, 0.5]) cube(size=[2.0,2.0,2.0], center=false);\n}\n```",
    "expected": "union() {\n  translate([0.5, 0.5, 0.5]) cube(size=[2.0,2.0,2.0], center=false);\n  translate([2.75, -1.5, 3.25]) sphere(r=1.875);\n}"
  },
  {
    "dataset_index": 14,
    "prompt": "Task: Modify the OpenSCAD program according to the instruction.\n\nReturn the full updated OpenSCAD code.\nDo not explain anything.\n\nInstruction:\nAdd one tapered cylinder by absolute base-center coordinates. Keep all existing geometry unchanged. The new cylinder must use center=false with r1=3, r2=1.5, h=7, and base center exactly at [6,-2,0].\n\nExisting OpenSCAD:\n```scad\nunion() {\n  translate([0, 9, 0]) cube(size=[2,2,1], center=false);\n}\n```",
    "expected": "union() {\n  translate([0, 9, 0]) cube(size=[2,2,1], center=false);\n  translate([6, -2, 0]) cylinder(h=7, r1=3, r2=1.5, center=false);\n}"
  },
  {
    "dataset_index": 15,
    "prompt": "Task: Modify the OpenSCAD program according to the instruction.\n\nReturn the full updated OpenSCAD code.\nDo not explain anything.\n\nInstruction:\nAdd one elliptical cylinder using scale transformation. Keep existing geometry unchanged. Base center at [1, 1, 0], radius X=3, radius Y=1.5, height 6.\n\nExisting OpenSCAD:\n```scad\nunion() {\n  translate([0, 0, 10]) sphere(r=2);\n}\n```",
    "expected": "union() {\n  translate([0, 0, 10]) sphere(r=2);\n  translate([1, 1, 0]) scale([3, 1.5, 1]) cylinder(r=1, h=6);\n}"
  },
  {
    "dataset_index": 18,
    "prompt": "Task: Modify the OpenSCAD program according to the instruction.\n\nReturn the full updated OpenSCAD code.\nDo not explain anything.\n\nInstruction:\nAdd a tapered cylinder with floating-point radii, height, and base-center coordinates. Keep the existing geometry unchanged. Add one cylinder with r1=2.4, r2=0.85, h=5.5, and base center [-3.25,2.75,0.25].\n\nExisting OpenSCAD:\n```scad\nunion() {\n  translate([4.0, -1.5, 0.0]) cube(size=[2.0,2.0,2.0], center=false);\n}\n```",
    "expected": "union() {\n  translate([4.0, -1.5, 0.0]) cube(size=[2.0,2.0,2.0], center=false);\n  translate([-3.25, 2.75, 0.25]) cylinder(r1=2.4, r2=0.85, h=5.5);\n}"
  },
  {
    "dataset_index": 22,
    "prompt": "Task: Modify the OpenSCAD program according to the instruction.\n\nReturn the full updated OpenSCAD code.\nDo not explain anything.\n\nInstruction:\nAdd a cone represented by cylinder(r1, r2=0) using floating-point values. Keep the existing geometry unchanged. Add one cone with base radius 1.8, height 4.6, and base center [2.2,3.4,0.0].\n\nExisting OpenSCAD:\n```scad\nunion() {\n  translate([-3.5, -3.5, 0.0]) cube(size=[3.0,3.0,3.0], center=false);\n}\n```",
    "expected": "union() {\n  translate([-3.5, -3.5, 0.0]) cube(size=[3.0,3.0,3.0], center=false);\n  translate([2.2, 3.4, 0.0]) cylinder(r1=1.8, r2=0, h=4.6);\n}"
  },
  {
    "dataset_index": 26,
    "prompt": "Task: Modify the OpenSCAD program according to the instruction.\n\nReturn the full updated OpenSCAD code.\nDo not explain anything.\n\nInstruction:\nAdd the torus-style proxy primitive using floating-point placement. Keep the existing geometry unchanged. Add one proxy torus primitive centered near [3.5,-2.5,1.25] using a tapered cylinder approximation with r1=2.6, r2=1.2, h=2.75.\n\nExisting OpenSCAD:\n```scad\nunion() {\n  translate([-2.5, 1.5, 0.0]) cube(size=[2.5,2.5,2.5], center=false);\n}\n```",
    "expected": "union() {\n  translate([-2.5, 1.5, 0.0]) cube(size=[2.5,2.5,2.5], center=false);\n  translate([3.5, -2.5, 1.25]) cylinder(r1=2.6, r2=1.2, h=2.75);\n}"
  },
  {
    "dataset_index": 29,
    "prompt": "Task: Modify the OpenSCAD program according to the instruction.\n\nReturn the full updated OpenSCAD code.\nDo not explain anything.\n\nInstruction:\nAdd a polygon extrusion with floating-point translation and radius values. Keep the existing geometry unchanged. Add a hexagon-like extrusion at [2.5,1.75,0.0] using circle(r=1.85, $fn=6) and linear_extrude(height=3.75).\n\nExisting OpenSCAD:\n```scad\nunion() {\n  translate([-4.0, -1.0, 0.0]) cube(size=[3.5,3.5,2.0], center=false);\n}\n```",
    "expected": "union() {\n  translate([-4.0, -1.0, 0.0]) cube(size=[3.5,3.5,2.0], center=false);\n  translate([2.5, 1.75, 0.0]) linear_extrude(height=3.75) circle(r=1.85, $fn=6);\n}"
  },
  {
    "dataset_index": 31,
    "prompt": "Task: Modify the OpenSCAD program according to the instruction.\n\nReturn the full updated OpenSCAD code.\nDo not explain anything.\n\nInstruction:\nAdd a cube on top of the existing cube, centering the new cube on the top face of the existing cube. The new cube should have the same dimensions [4,4,4] as the existing cube.\n\nExisting OpenSCAD:\n```scad\nunion() {\n  translate([0, 0, 0]) cube(size=[4,4,4], center=false);\n}\n```",
    "expected": "union() {\n  translate([0, 0, 0]) cube(size=[4,4,4], center=false);\n  translate([0, 0, 4]) cube(size=[4,4,4], center=false);\n}"
  },
  {
    "dataset_index": 34,
    "prompt": "Task: Modify the OpenSCAD program according to the instruction.\n\nReturn the full updated OpenSCAD code.\nDo not explain anything.\n\nInstruction:\nAdd a cylinder on top of the existing offset cube. The cylinder should have radius 0.9 and height 3.3, and its base-center should be aligned to the cube's top-right-back corner.\n\nExisting OpenSCAD:\n```scad\nunion() {\n  translate([-3.4, 1.2, -0.8]) cube(size=[5.5,3.5,2.7], center=false);\n}\n```",
    "expected": "union() {\n  translate([-3.4, 1.2, -0.8]) cube(size=[5.5,3.5,2.7], center=false);\n  translate([2.1, 4.7, 1.9]) cylinder(h=3.3, r=0.9, center=false);\n}"
  },
  {
    "dataset_index": 36,
    "prompt": "Task: Modify the OpenSCAD program according to the instruction.\n\nReturn the full updated OpenSCAD code.\nDo not explain anything.\n\nInstruction:\nAdd a sphere above the existing cylinder such that the sphere is tangent to the cylinder's top face. The sphere should have radius 1.5 and touch the cylinder's top face at exactly one point.\n\nExisting OpenSCAD:\n```scad\nunion() {\n  translate([0, 0, 0]) cylinder(h=4, r=2, center=false);\n}\n```",
    "expected": "union() {\n  translate([0, 0, 0]) cylinder(h=4, r=2, center=false);\n  translate([0, 0, 5.5]) sphere(r=1.5);\n}"
  },
  {
    "dataset_index": 41,
    "prompt": "Task: Modify the OpenSCAD program according to the instruction.\n\nReturn the full updated OpenSCAD code.\nDo not explain anything.\n\nInstruction:\nAdd a cylinder beside the existing cylinder, positioned so it touches the side of the target cylinder along the x-axis. The new cylinder should have height 4 and radius 1.5.\n\nExisting OpenSCAD:\n```scad\nunion() {\n  translate([0, 0, 0]) cylinder(h=4, r=2, center=false);\n}\n```",
    "expected": "union() {\n  translate([0, 0, 0]) cylinder(h=4, r=2, center=false);\n  translate([3.5, 0, 0]) cylinder(h=4, r=1.5, center=false);\n}"
  },
  {
    "dataset_index": 44,
    "prompt": "Task: Modify the OpenSCAD program according to the instruction.\n\nReturn the full updated OpenSCAD code.\nDo not explain anything.\n\nInstruction:\nAdd a sphere beside the existing offset sphere along the positive y-axis with a 0.55 unit gap between surfaces. The new sphere should have radius 0.9.\n\nExisting OpenSCAD:\n```scad\nunion() {\n  translate([-1.75, 2.4, 0.5]) sphere(r=1.3);\n}\n```",
    "expected": "union() {\n  translate([-1.75, 2.4, 0.5]) sphere(r=1.3);\n  translate([-1.75, 5.15, 0.5]) sphere(r=0.9);\n}"
  },
  {
    "dataset_index": 47,
    "prompt": "Task: Modify the OpenSCAD program according to the instruction.\n\nReturn the full updated OpenSCAD code.\nDo not explain anything.\n\nInstruction:\nAdd a cylinder below the existing cube, centered under the cube's bottom face. The cylinder should have radius 1.5, height 4, and its top face should touch the cube's bottom face.\n\nExisting OpenSCAD:\n```scad\nunion() {\n  translate([0, 0, 0]) cube(size=[6,6,6], center=false);\n}\n```",
    "expected": "union() {\n  translate([0, 0, 0]) cube(size=[6,6,6], center=false);\n  translate([3, 3, -4]) cylinder(h=4, r=1.5, center=false);\n}"
  },
  {
    "dataset_index": 49,
    "prompt": "Task: Modify the OpenSCAD program according to the instruction.\n\nReturn the full updated OpenSCAD code.\nDo not explain anything.\n\nInstruction:\nAdd a sphere below the existing offset cube, centered in x and y to the cube, with a 0.4 unit gap from the cube's bottom face. The new sphere should have radius 1.05.\n\nExisting OpenSCAD:\n```scad\nunion() {\n  translate([-5.0, 1.75, 2.6]) cube(size=[3.4,2.8,1.6], center=false);\n}\n```",
    "expected": "union() {\n  translate([-5.0, 1.75, 2.6]) cube(size=[3.4,2.8,1.6], center=false);\n  translate([-3.3, 3.15, 1.15]) sphere(r=1.05);\n}"
  },
  {
    "dataset_index": 50,
    "prompt": "Task: Modify the OpenSCAD program according to the instruction.\n\nReturn the full updated OpenSCAD code.\nDo not explain anything.\n\nInstruction:\nComplete the pattern: this should be a full 3 by 3 grid of cubes on the XY plane at z=0. Each cube is size [2,2,2], and origins are spaced by 4 units in x and y. One cube is missing at the center. Add the missing cube.\n\nExisting OpenSCAD:\n```scad\nunion() {\n  translate([0, 0, 0]) cube(size=[2,2,2], center=false);\n  translate([4, 0, 0]) cube(size=[2,2,2], center=false);\n  translate([8, 0, 0]) cube(size=[2,2,2], center=false);\n\n  translate([0, 4, 0]) cube(size=[2,2,2], center=false);\n  translate([8, 4, 0]) cube(size=[2,2,2], center=false);\n\n  translate([0, 8, 0]) cube(size=[2,2,2], center=false);\n  translate([4, 8, 0]) cube(size=[2,2,2], center=false);\n  translate([8, 8, 0]) cube(size=[2,2,2], center=false);\n}\n```",
    "expected": "// Completed 3x3 grid.\nunion() {\n  translate([0, 0, 0]) cube(size=[2,2,2], center=false);\n  translate([4, 0, 0]) cube(size=[2,2,2], center=false);\n  translate([8, 0, 0]) cube(size=[2,2,2], center=false);\n\n  translate([0, 4, 0]) cube(size=[2,2,2], center=false);\n  translate([4, 4, 0]) cube(size=[2,2,2], center=false);\n  translate([8, 4, 0]) cube(size=[2,2,2], center=false);\n\n  translate([0, 8, 0]) cube(size=[2,2,2], center=false);\n  translate([4, 8, 0]) cube(size=[2,2,2], center=false);\n  translate([8, 8, 0]) cube(size=[2,2,2], center=false);\n}"
  },
  {
    "dataset_index": 51,
    "prompt": "Task: Modify the OpenSCAD program according to the instruction.\n\nReturn the full updated OpenSCAD code.\nDo not explain anything.\n\nInstruction:\nThere should be a complete 4 by 4 grid of cubes on z=0, with cube size [2,2,2] and step 4 in both x and y. One off-center cell is missing at grid index (3,2) using zero-based indices. Add the missing cube to complete the grid.\n\nExisting OpenSCAD:\n```scad\nunion() {\n  for (ix = [0:3]) {\n    for (iy = [0:3]) {\n      if (!(ix == 3 && iy == 2)) {\n        translate([ix * 4, iy * 4, 0]) cube(size=[2,2,2], center=false);\n      }\n    }\n  }\n}\n```",
    "expected": "// Completed 4x4 grid.\nunion() {\n  for (ix = [0:3]) {\n    for (iy = [0:3]) {\n      translate([ix * 4, iy * 4, 0]) cube(size=[2,2,2], center=false);\n    }\n  }\n}"
  },
  {
    "dataset_index": 54,
    "prompt": "Task: Modify the OpenSCAD program according to the instruction.\n\nReturn the full updated OpenSCAD code.\nDo not explain anything.\n\nInstruction:\nComplete the pattern as a full 3 by 4 grid of cubes on z=1.25. Cube size is [1.5,1.5,1.5]. Origins use step 3.25 in x and 2.75 in y, starting from [18.5, 26.25, 1.25]. One corner cube is missing. Add the missing cube.\n\nExisting OpenSCAD:\n```scad\nunion() {\n  for (ix = [0:2]) {\n    for (iy = [0:3]) {\n      if (!(ix == 2 && iy == 3)) {\n        translate([18.5 + ix * 3.25, 26.25 + iy * 2.75, 1.25]) cube(size=[1.5,1.5,1.5], center=false);\n      }\n    }\n  }\n}\n```",
    "expected": "union() {\n  for (ix = [0:2]) {\n    for (iy = [0:3]) {\n      translate([18.5 + ix * 3.25, 26.25 + iy * 2.75, 1.25]) cube(size=[1.5,1.5,1.5], center=false);\n    }\n  }\n}"
  },
  {
    "dataset_index": 56,
    "prompt": "Task: Modify the OpenSCAD program according to the instruction.\n\nReturn the full updated OpenSCAD code.\nDo not explain anything.\n\nInstruction:\nThis model should be an 8-step staircase made of identical cubes. Step i has origin [i*3, 0, i*2], cube size [2,6,2], for i=0..7. One middle step is missing. Find and add the missing step.\n\nExisting OpenSCAD:\n```scad\nunion() {\n  for (i = [0:7]) {\n    if (i != 4) {\n      translate([i * 3, 0, i * 2]) cube(size=[2,6,2], center=false);\n    }\n  }\n}\n```",
    "expected": "// Completed staircase.\nunion() {\n  for (i = [0:7]) {\n    translate([i * 3, 0, i * 2]) cube(size=[2,6,2], center=false);\n  }\n}"
  },
  {
    "dataset_index": 60,
    "prompt": "Task: Modify the OpenSCAD program according to the instruction.\n\nReturn the full updated OpenSCAD code.\nDo not explain anything.\n\nInstruction:\nThis model should be a 6-step staircase made of identical blocks. Step i has origin [22.4 + i*2.8, 14.6, 1.4 + i*1.35], block size [1.6,4.2,1.1], for i=0..5. One step is missing. Add the missing step.\n\nExisting OpenSCAD:\n```scad\nunion() {\n  for (i = [0:5]) {\n    if (i != 3) {\n      translate([22.4 + i * 2.8, 14.6, 1.4 + i * 1.35]) cube(size=[1.6,4.2,1.1], center=false);\n    }\n  }\n}\n```",
    "expected": "union() {\n  for (i = [0:5]) {\n    translate([22.4 + i * 2.8, 14.6, 1.4 + i * 1.35]) cube(size=[1.6,4.2,1.1], center=false);\n  }\n}"
  },
  {
    "dataset_index": 62,
    "prompt": "Task: Modify the OpenSCAD program according to the instruction.\n\nReturn the full updated OpenSCAD code.\nDo not explain anything.\n\nInstruction:\nThe shape should be mirror-symmetric across x=0 for all spheres (same radius). Existing sphere centers are (-6,3,0), (6,3,0), and (9,-5,0), with r=2. Add the missing mirrored sphere to complete x=0 symmetry.\n\nExisting OpenSCAD:\n```scad\nunion() {\n  translate([-6, 3, 0]) sphere(r=2);\n  translate([6, 3, 0]) sphere(r=2);\n  translate([9, -5, 0]) sphere(r=2);\n}\n```",
    "expected": "// Completed x=0 mirror symmetry.\nunion() {\n  translate([-6, 3, 0]) sphere(r=2);\n  translate([6, 3, 0]) sphere(r=2);\n  translate([9, -5, 0]) sphere(r=2);\n  translate([-9, -5, 0]) sphere(r=2);\n}"
  },
  {
    "dataset_index": 67,
    "prompt": "Task: Modify the OpenSCAD program according to the instruction.\n\nReturn the full updated OpenSCAD code.\nDo not explain anything.\n\nInstruction:\nThe model should have four-quadrant symmetry across x=0 and y=0 using identical cylinders with r=1.8 and h=4.75. Existing base centers are [16.4, 27.2, 1.1], [-16.4, 27.2, 1.1], and [16.4, -27.2, 1.1]. Add the missing cylinder.\n\nExisting OpenSCAD:\n```scad\nunion() {\n  translate([16.4, 27.2, 1.1]) cylinder(r=1.8, h=4.75, center=false);\n  translate([-16.4, 27.2, 1.1]) cylinder(r=1.8, h=4.75, center=false);\n  translate([16.4, -27.2, 1.1]) cylinder(r=1.8, h=4.75, center=false);\n}\n```",
    "expected": "union() {\n  translate([16.4, 27.2, 1.1]) cylinder(r=1.8, h=4.75, center=false);\n  translate([-16.4, 27.2, 1.1]) cylinder(r=1.8, h=4.75, center=false);\n  translate([16.4, -27.2, 1.1]) cylinder(r=1.8, h=4.75, center=false);\n  translate([-16.4, -27.2, 1.1]) cylinder(r=1.8, h=4.75, center=false);\n}"
  },
  {
    "dataset_index": 71,
    "prompt": "Task: Modify the OpenSCAD program according to the instruction.\n\nReturn the full updated OpenSCAD code.\nDo not explain anything.\n\nInstruction:\nThere should be 8 corner spheres (r=1) at the corners of a box with x in {-6,6}, y in {-4,4}, z in {0,8}. One corner sphere is missing at (-6,-4,8). Add the missing sphere.\n\nExisting OpenSCAD:\n```scad\nunion() {\n  translate([-6, -4, 0]) sphere(r=1);\n  translate([6, -4, 0]) sphere(r=1);\n  translate([-6, 4, 0]) sphere(r=1);\n  translate([6, 4, 0]) sphere(r=1);\n\n  translate([6, -4, 8]) sphere(r=1);\n  translate([-6, 4, 8]) sphere(r=1);\n  translate([6, 4, 8]) sphere(r=1);\n}\n```",
    "expected": "// Completed 8-corner sphere skeleton.\nunion() {\n  // z = 0 layer\n  translate([-6, -4, 0]) sphere(r=1);\n  translate([6, -4, 0]) sphere(r=1);\n  translate([-6, 4, 0]) sphere(r=1);\n  translate([6, 4, 0]) sphere(r=1);\n\n  // z = 8 layer\n  translate([-6, -4, 8]) sphere(r=1);\n  translate([6, -4, 8]) sphere(r=1);\n  translate([-6, 4, 8]) sphere(r=1);\n  translate([6, 4, 8]) sphere(r=1);\n}"
  },
  {
    "dataset_index": 73,
    "prompt": "Task: Modify the OpenSCAD program according to the instruction.\n\nReturn the full updated OpenSCAD code.\nDo not explain anything.\n\nInstruction:\nComplete the barcode pattern offset from the origin. There should be 6 vertical bars starting at x=28.5, y=17.75, z=0.9 with x step 2.35. Each bar has size [1.1,1.6,h]. Heights from left to right are [2.4, 5.1, 3.3, 6.2, 4.4, 2.8]. One bar is missing. Add the missing bar.\n\nExisting OpenSCAD:\n```scad\nunion() {\n  translate([28.5, 17.75, 0.9]) cube(size=[1.1,1.6,2.4], center=false);\n  translate([30.85, 17.75, 0.9]) cube(size=[1.1,1.6,5.1], center=false);\n  translate([33.2, 17.75, 0.9]) cube(size=[1.1,1.6,3.3], center=false);\n  translate([37.9, 17.75, 0.9]) cube(size=[1.1,1.6,4.4], center=false);\n  translate([40.25, 17.75, 0.9]) cube(size=[1.1,1.6,2.8], center=false);\n}\n```",
    "expected": "union() {\n  translate([28.5, 17.75, 0.9]) cube(size=[1.1,1.6,2.4], center=false);\n  translate([30.85, 17.75, 0.9]) cube(size=[1.1,1.6,5.1], center=false);\n  translate([33.2, 17.75, 0.9]) cube(size=[1.1,1.6,3.3], center=false);\n  translate([35.55, 17.75, 0.9]) cube(size=[1.1,1.6,6.2], center=false);\n  translate([37.9, 17.75, 0.9]) cube(size=[1.1,1.6,4.4], center=false);\n  translate([40.25, 17.75, 0.9]) cube(size=[1.1,1.6,2.8], center=false);\n}"
  },
  {
    "dataset_index": 76,
    "prompt": "Task: Modify the OpenSCAD program according to the instruction.\n\nReturn the full updated OpenSCAD code.\nDo not explain anything.\n\nInstruction:\nAdd one cylinder fully inside the current bounding box so the overall bounding box does not change. The new cylinder should have base center at [29.4, 20.8, 3.7], radius 1.2, and height 2.6. Add only this cylinder.\n\nExisting OpenSCAD:\n```scad\nunion() {\n  translate([23.6, 16.4, 2.1]) cube(size=[9.4,7.8,5.9], center=false);\n  translate([33.9, 18.7, 2.8]) cube(size=[4.9,6.5,4.8], center=false);\n}\n```",
    "expected": "union() {\n  translate([23.6, 16.4, 2.1]) cube(size=[9.4,7.8,5.9], center=false);\n  translate([33.9, 18.7, 2.8]) cube(size=[4.9,6.5,4.8], center=false);\n  translate([29.4, 20.8, 3.7]) cylinder(r=1.2, h=2.6, center=false);\n}"
  },
  {
    "dataset_index": 86,
    "prompt": "Task: Modify the OpenSCAD program according to the instruction.\n\nReturn the full updated OpenSCAD code.\nDo not explain anything.\n\nInstruction:\nAdd one cube so that the final scene hits the target bbox edge defined by max x = 44.85 and max y = 39.10 exactly, while staying within the current z range. The new cube should have lower-left-bottom corner at [41.65, 36.85, 3.00] and size [3.20, 2.25, 2.10]. Add only this cube.\n\nExisting OpenSCAD:\n```scad\nunion() {\n  translate([27.5, 22.4, 2.3]) cube(size=[8.1,7.2,5.8], center=false);\n  translate([36.2, 24.1, 3.1]) cube(size=[4.9,8.4,4.4], center=false);\n}\n```",
    "expected": "union() {\n  translate([27.5, 22.4, 2.3]) cube(size=[8.1,7.2,5.8], center=false);\n  translate([36.2, 24.1, 3.1]) cube(size=[4.9,8.4,4.4], center=false);\n  translate([41.65, 36.85, 3.0]) cube(size=[3.2,2.25,2.1], center=false);\n}"
  },
  {
    "dataset_index": 94,
    "prompt": "Task: Modify the OpenSCAD program according to the instruction.\n\nReturn the full updated OpenSCAD code.\nDo not explain anything.\n\nInstruction:\nComplete the arrangement: this should be a line of 6 identical tapered cylinders along the x axis. Each primitive is cylinder(r1=1.2, r2=0.6, h=3) with base centers at [0,10,0], [3,10,0], [6,10,0], [9,10,0], [12,10,0], and [15,10,0]. The tapered cylinder at [12,10,0] is missing. Add the missing primitive.\n\nExisting OpenSCAD:\n```scad\nunion() {\n\ttranslate([0, 10, 0]) cylinder(r1=1.2, r2=0.6, h=3);\n\ttranslate([3, 10, 0]) cylinder(r1=1.2, r2=0.6, h=3);\n\ttranslate([6, 10, 0]) cylinder(r1=1.2, r2=0.6, h=3);\n\ttranslate([9, 10, 0]) cylinder(r1=1.2, r2=0.6, h=3);\n\ttranslate([15, 10, 0]) cylinder(r1=1.2, r2=0.6, h=3);\n}\n```",
    "expected": "union() {\n\ttranslate([0, 10, 0]) cylinder(r1=1.2, r2=0.6, h=3);\n\ttranslate([3, 10, 0]) cylinder(r1=1.2, r2=0.6, h=3);\n\ttranslate([6, 10, 0]) cylinder(r1=1.2, r2=0.6, h=3);\n\ttranslate([9, 10, 0]) cylinder(r1=1.2, r2=0.6, h=3);\n\ttranslate([12, 10, 0]) cylinder(r1=1.2, r2=0.6, h=3);\n\ttranslate([15, 10, 0]) cylinder(r1=1.2, r2=0.6, h=3);\n}"
  },
  {
    "dataset_index": 106,
    "prompt": "Task: Modify the OpenSCAD program according to the instruction.\n\nReturn the full updated OpenSCAD code.\nDo not explain anything.\n\nInstruction:\nComplete the arrangement: this should be a 3 by 2 grid of identical cubes with floating-point step sizes. Each cube has size [1.25,1.25,1.25] and origins at [0.5,0.5,0.0], [3.0,0.5,0.0], [5.5,0.5,0.0], [0.5,3.25,0.0], [3.0,3.25,0.0], and [5.5,3.25,0.0]. The cube at [3.0,3.25,0.0] is missing. Add the missing cube.\n\nExisting OpenSCAD:\n```scad\nunion() {\n  translate([0.5, 0.5, 0.0]) cube(size=[1.25,1.25,1.25], center=false);\n  translate([3.0, 0.5, 0.0]) cube(size=[1.25,1.25,1.25], center=false);\n  translate([5.5, 0.5, 0.0]) cube(size=[1.25,1.25,1.25], center=false);\n  translate([0.5, 3.25, 0.0]) cube(size=[1.25,1.25,1.25], center=false);\n  translate([5.5, 3.25, 0.0]) cube(size=[1.25,1.25,1.25], center=false);\n}\n```",
    "expected": "union() {\n  translate([0.5, 0.5, 0.0]) cube(size=[1.25,1.25,1.25], center=false);\n  translate([3.0, 0.5, 0.0]) cube(size=[1.25,1.25,1.25], center=false);\n  translate([5.5, 0.5, 0.0]) cube(size=[1.25,1.25,1.25], center=false);\n  translate([0.5, 3.25, 0.0]) cube(size=[1.25,1.25,1.25], center=false);\n  translate([3.0, 3.25, 0.0]) cube(size=[1.25,1.25,1.25], center=false);\n  translate([5.5, 3.25, 0.0]) cube(size=[1.25,1.25,1.25], center=false);\n}"
  },
  {
    "dataset_index": 118,
    "prompt": "Task: Modify the OpenSCAD program according to the instruction.\n\nReturn the full updated OpenSCAD code.\nDo not explain anything.\n\nInstruction:\nComplete the arrangement: this scene should contain 8 identical cylinders in a rectangular layout symmetric across both x=0 and y=0 with floating-point coordinates. Each cylinder has radius 0.65, height 3.25, and base centers at [-6.5,-2.25,0.0], [-6.5,2.25,0.0], [-2.5,-2.25,0.0], [-2.5,2.25,0.0], [2.5,-2.25,0.0], [2.5,2.25,0.0], [6.5,-2.25,0.0], and [6.5,2.25,0.0]. The cylinder at [6.5,2.25,0.0] is missing. Add the missing cylinder.\n\nExisting OpenSCAD:\n```scad\nunion() {\n  translate([-6.5, -2.25, 0.0]) cylinder(r=0.65, h=3.25);\n  translate([-6.5, 2.25, 0.0]) cylinder(r=0.65, h=3.25);\n  translate([-2.5, -2.25, 0.0]) cylinder(r=0.65, h=3.25);\n  translate([-2.5, 2.25, 0.0]) cylinder(r=0.65, h=3.25);\n  translate([2.5, -2.25, 0.0]) cylinder(r=0.65, h=3.25);\n  translate([2.5, 2.25, 0.0]) cylinder(r=0.65, h=3.25);\n  translate([6.5, -2.25, 0.0]) cylinder(r=0.65, h=3.25);\n}\n```",
    "expected": "union() {\n  translate([-6.5, -2.25, 0.0]) cylinder(r=0.65, h=3.25);\n  translate([-6.5, 2.25, 0.0]) cylinder(r=0.65, h=3.25);\n  translate([-2.5, -2.25, 0.0]) cylinder(r=0.65, h=3.25);\n  translate([-2.5, 2.25, 0.0]) cylinder(r=0.65, h=3.25);\n  translate([2.5, -2.25, 0.0]) cylinder(r=0.65, h=3.25);\n  translate([2.5, 2.25, 0.0]) cylinder(r=0.65, h=3.25);\n  translate([6.5, -2.25, 0.0]) cylinder(r=0.65, h=3.25);\n  translate([6.5, 2.25, 0.0]) cylinder(r=0.65, h=3.25);\n}"
  }
]

def normalize_scad(text: str) -> str:
    """
    Normalize line endings, trim surrounding whitespace, strip markdown fences,
    collapse runs of spaces/tabs, and drop blank lines for a fair exact-match check.
    """
    text = text.replace("\r\n", "\n").replace("\r", "\n").strip()

    # Remove markdown fences if the model emits them.
    text = re.sub(r"^```(?:scad)?\s*\n", "", text)
    text = re.sub(r"\n```$", "", text)
    text = text.strip()

    normalized_lines = []
    for line in text.split("\n"):
        line = re.sub(r"[ \t]+", " ", line).strip()
        if line:
            normalized_lines.append(line)
    return "\n".join(normalized_lines)

def try_extract_scad(text: str) -> str:
    """
    If the model wraps the code in explanation or markdown fences,
    try to extract the most likely code block. Falls back to raw text.
    """
    fenced = re.findall(r"```(?:scad)?\s*\n(.*?)```", text, flags=re.DOTALL | re.IGNORECASE)
    if fenced:
        return fenced[0].strip()

    # If it starts with something like union()/difference()/translate(), keep raw.
    return text.strip()

def build_client(base_url: str, api_key: str) -> OpenAI:
    return OpenAI(base_url=base_url, api_key=api_key)

def run_case(client: OpenAI, model: str, prompt: str, temperature: float, max_tokens: int | None) -> dict:
    start = time.perf_counter()
    kwargs = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": temperature,
    }
    if max_tokens is not None:
        kwargs["max_tokens"] = max_tokens

    response = client.chat.completions.create(**kwargs)
    elapsed = time.perf_counter() - start
    content = response.choices[0].message.content or ""
    usage = getattr(response, "usage", None)
    return {
        "raw_output": content,
        "elapsed_sec": elapsed,
        "usage": {
            "prompt_tokens": getattr(usage, "prompt_tokens", None) if usage else None,
            "completion_tokens": getattr(usage, "completion_tokens", None) if usage else None,
            "total_tokens": getattr(usage, "total_tokens", None) if usage else None,
        },
    }

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://localhost:12345/v1")
    parser.add_argument("--model", default="qwen3.5-9b-openscad_gguf")
    parser.add_argument("--api-key", default="lm-studio")
    parser.add_argument("--temperature", type=float, default=0.0)
    parser.add_argument("--max-tokens", type=int, default=4096)
    parser.add_argument("--output", default="lmstudio_scad_benchmark_results.txt")
    args = parser.parse_args()

    output_path = Path(args.output).resolve()
    client = build_client(args.base_url, args.api_key)

    lines: list[str] = []
    lines.append("LM Studio OpenSCAD Benchmark Results")
    lines.append("=" * 80)
    lines.append(f"Base URL: {args.base_url}")
    lines.append(f"Model: {args.model}")
    lines.append(f"Temperature: {args.temperature}")
    lines.append(f"Max tokens: {args.max_tokens}")
    lines.append(f"Cases: {len(SELECTED_CASES)}")
    lines.append("")

    exact_match_count = 0
    normalized_match_count = 0
    extracted_normalized_match_count = 0
    total_elapsed = 0.0

    for i, case in enumerate(SELECTED_CASES, start=1):
        case_id = case["dataset_index"]
        prompt = case["prompt"]
        expected = case["expected"]

        lines.append("-" * 80)
        lines.append(f"Case {i}/{len(SELECTED_CASES)} | Dataset index: {case_id}")

        try:
            result = run_case(
                client=client,
                model=args.model,
                prompt=prompt,
                temperature=args.temperature,
                max_tokens=args.max_tokens,
            )
            raw_output = result["raw_output"]
            total_elapsed += result["elapsed_sec"]

            raw_exact_match = raw_output.strip() == expected.strip()
            norm_output = normalize_scad(raw_output)
            norm_expected = normalize_scad(expected)
            normalized_match = norm_output == norm_expected

            extracted_output = try_extract_scad(raw_output)
            extracted_norm_output = normalize_scad(extracted_output)
            extracted_normalized_match = extracted_norm_output == norm_expected

            exact_match_count += int(raw_exact_match)
            normalized_match_count += int(normalized_match)
            extracted_normalized_match_count += int(extracted_normalized_match)

            lines.append(f"Status: OK")
            lines.append(f"Latency: {result['elapsed_sec']:.2f}s")
            usage = result["usage"]
            lines.append(
                f"Tokens: prompt={usage['prompt_tokens']} completion={usage['completion_tokens']} total={usage['total_tokens']}"
            )
            lines.append(f"Raw exact match: {raw_exact_match}")
            lines.append(f"Normalized exact match: {normalized_match}")
            lines.append(f"Extracted-code normalized match: {extracted_normalized_match}")
            lines.append("")
            lines.append("PROMPT")
            lines.append(prompt)
            lines.append("")
            lines.append("EXPECTED")
            lines.append(expected)
            lines.append("")
            lines.append("MODEL OUTPUT")
            lines.append(raw_output.strip())
            lines.append("")

        except Exception as e:
            lines.append("Status: ERROR")
            lines.append(f"Error: {type(e).__name__}: {e}")
            lines.append("")

    lines.append("=" * 80)
    lines.append("SUMMARY")
    lines.append(f"Raw exact matches: {exact_match_count}/{len(SELECTED_CASES)}")
    lines.append(f"Normalized exact matches: {normalized_match_count}/{len(SELECTED_CASES)}")
    lines.append(f"Extracted-code normalized matches: {extracted_normalized_match_count}/{len(SELECTED_CASES)}")
    lines.append(f"Total elapsed: {total_elapsed:.2f}s")
    lines.append(f"Average elapsed per successful case: {total_elapsed / max(1, len(SELECTED_CASES)):.2f}s")

    output_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"Saved results to: {output_path}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
