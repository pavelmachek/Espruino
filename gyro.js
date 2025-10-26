eval(require("fs").readFile("sdl.js"));

let x = 0, y = 0, z = 0;

function integrate(v) {
    let step = (1/20)  * (10/6.1);
    // Rotating clockwise around power button increases this.
    x += step * v.x;
    // When phone is rotated counterclockwise around usb-C port, this increases
    y += step * v.y;
    // When phone is rotated clockwise (on flat surface), z increases
    // 10 rotations are approximately 6.1 increase
    z += step * v.z;
    print(x, y, z);
}

Bangle.on('gyro', integrate);
