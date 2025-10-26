eval(require("fs").readFile("sdl.js"));

let x = 0, y = 0, z = 0;

function integrate(v) {
    let step = 1/20;
    x += step * v.x;
    y += step * v.y;
    // When phone is rotated clockwise (on flat surface), z increases
    z += step * v.z;
    print(x, y, z);
}

Bangle.on('gyro', integrate);
