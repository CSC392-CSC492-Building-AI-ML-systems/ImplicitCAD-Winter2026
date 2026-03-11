union() {
  for (i = [0:7]) {
    if (i != 4) {
      translate([i * 3, 0, i * 2]) cube(size=[2,6,2], center=false);
    }
  }
}

