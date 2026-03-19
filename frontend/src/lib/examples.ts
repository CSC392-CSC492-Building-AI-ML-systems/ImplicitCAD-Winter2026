export interface Example {
  name: string
  desc: string
  code: string
}

export const EXAMPLES: Example[] = [
  {
    name: 'Cube with Sphere Cut',
    desc: 'Boolean difference',
    code: `difference() {\n    cube([20, 20, 20], center = true);\n    sphere(r = 13);\n}`,
  },
  {
    name: 'Simple Sphere',
    desc: 'Basic primitive',
    code: `sphere(r = 15, $fn = 32);`,
  },
  {
    name: 'Tapered Cylinder',
    desc: 'Cone-like shape',
    code: `cylinder(h = 30, r1 = 15, r2 = 8, center = true, $fn = 48);`,
  },
  {
    name: 'Cross Shape',
    desc: 'Union of cylinders',
    code: `union() {\n    cube([10, 10, 20], center = true);\n    rotate([90, 0, 0]) cylinder(h = 30, r = 5, center = true);\n    rotate([0, 90, 0]) cylinder(h = 30, r = 5, center = true);\n}`,
  },
  {
    name: 'Flanged Cylinder',
    desc: 'Complex boolean',
    code: `difference() {\n    union() {\n        cube([30, 30, 10], center = true);\n        translate([0, 0, 10]) cylinder(h = 10, r = 10, center = true);\n    }\n    cylinder(h = 25, r = 5, center = true);\n    for (i = [0:3]) {\n        rotate([0, 0, i * 90])\n            translate([12, 0, 0])\n                cylinder(h = 15, r = 3, center = true);\n    }\n}`,
  },
  {
    name: 'Parametric Bracket',
    desc: 'Modules and variables',
    code: `wall = 3;\nheight = 20;\nwidth = 30;\ndepth = 15;\n\ndifference() {\n  union() {\n    cube([width, depth, wall]);\n    cube([wall, depth, height]);\n    translate([width - wall, 0, 0])\n      cube([wall, depth, height]);\n  }\n  translate([width/2, depth/2, -1])\n    cylinder(r=4, h=wall+2);\n}`,
  },
]

export const DEFAULT_CODE = `// ImplicitCAD Studio
// Edit this code or use the AI Assistant below!

difference() {
    cube([20, 20, 20], center = true);
    sphere(r = 13);
}
`
