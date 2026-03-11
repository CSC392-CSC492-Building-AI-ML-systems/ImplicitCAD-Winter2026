union() {
  translate([0, 0, 0]) cube(size=[2,2,2], center=false);
  translate([4, 0, 0]) cube(size=[2,2,2], center=false);
  translate([8, 0, 0]) cube(size=[2,2,2], center=false);

  translate([0, 4, 0]) cube(size=[2,2,2], center=false);
  translate([8, 4, 0]) cube(size=[2,2,2], center=false);

  translate([0, 8, 0]) cube(size=[2,2,2], center=false);
  translate([4, 8, 0]) cube(size=[2,2,2], center=false);
  translate([8, 8, 0]) cube(size=[2,2,2], center=false);
}

