union() {
  for (i = [0:7]) {
    if (i != 2) {
      translate([i * 3, 0, (7 - i) * 2]) cube(size=[2,5,2], center=false);
    }
  }
}

