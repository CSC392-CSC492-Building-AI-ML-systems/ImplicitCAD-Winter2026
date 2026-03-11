union() {
  for (ix = [0:4]) {
    for (iy = [0:1]) {
      if (!(ix == 4 && iy == 1)) {
        translate([ix * 3, iy * 3, 0]) cube(size=[2,2,2], center=false);
      }
    }
  }
}

