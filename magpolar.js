eval(require("fs").readFile("sdl.js"));

/*
B.js2. Assume device is lying on flat but tilted surface. Thus you can use accelerometer to estimate rotation. Do just that; then create a plot showing current rotation, and draw (color coded) points for magnetometer samples corresponding to this rotation. It should be polar plot.
￼
￼
￼
ChatGPT said:
Excellent — this is a solid calibration-style visualization:
use accelerometer to estimate the device’s tilt (pitch and roll), then use magnetometer data to show how the field varies as the device rotates in yaw (heading).
Here’s a working Bangle.js 2 script that does just that:

It continuously:

Estimates roll & pitch from the accelerometer (so we can correct magnetometer vectors),

Draws a polar plot (heading vs field strength),

Color-codes magnetometer points by tilt (optional visual cue).

*/

g.clear();
g.setFont("6x8",1);
g.setColor(1,0,0);

const centerX = g.getWidth()/2;
const centerY = g.getHeight()/2;
const radius = Math.min(centerX, centerY) - 10;

// Utility functions
function toDegrees(r){return r * 180/Math.PI;}
function toRadians(d){return Math.PI/180;}
function clamp(v,min,max){return v<min?min:v>max?max:v;}
function magnit(v){return Math.sqrt(v.x*v.x+v.y*v.y+v.z*v.z);}

// Rotation from accelerometer (tilt)
function getTilt(acc){
const norm = magnit(acc);
if (norm===0) return {pitch:0, roll:0};
const ax = acc.x/norm, ay = acc.y/norm, az = acc.z/norm;
const pitch = Math.atan2(-ax, Math.sqrt(ay*ay+az*az));
const roll = Math.atan2(ay, az);
return {pitch, roll};
}

// Rotate vector by pitch & roll
function rotateVector(v, pitch, roll){
// Rotation matrices: R = R_roll * R_pitch
const cp=Math.cos(pitch), sp=Math.sin(pitch);
const cr=Math.cos(roll), sr=Math.sin(roll);
const x1 = v.x;
const y1 = cr*v.y - sr*v.z;
const z1 = sr*v.y + cr*v.z;
const x2 = cp*x1 + sp*z1;
const y2 = y1;
const z2 = -sp*x1 + cp*z1;
return {x:x2,y:y2,z:z2};
}

// Convert corrected magnetometer to heading
function headingFromMag(m){
return Math.atan2(-m.y, m.x);
}

// Draw polar axes
function drawPolarAxes(){
g.clear();
g.setColor(0.3,0.3,0.3);
for (let r=radius/4; r<radius; r+=radius/4)
g.drawCircle(centerX, centerY, r);
for (let a=0;a<360;a+=30){
const rad=toRadians(a);
const x=centerX+Math.sin(rad)*radius;
const y=centerY-Math.cos(rad)*radius;
g.drawLine(centerX,centerY,x,y);
}
g.setColor(1,0,0);
g.drawString("Mag Polar", centerX-30, 5);
}

let samples = [];
drawPolarAxes();

Bangle.setCompassPower(1);

setInterval(function(){
    const acc = Bangle.getAccel();
    print("Acc:", acc);
const mag = Bangle.getCompass();

const tilt = getTilt(acc);
const corrected = rotateVector(mag, tilt.pitch, tilt.roll);
const heading = headingFromMag(corrected);
const fieldMag = mag.mag;

// Map heading and field magnitude to polar coordinates
const r = clamp(fieldMag*10, 0, radius);
const x = centerX + Math.sin(heading)*r;
const y = centerY - Math.cos(heading)*r;

// Color by roll angle
const hue = clamp((toDegrees(tilt.roll)+90)/180,0,1);
g.setColor(hue, 0.7, 1-hue);
g.fillCircle(x,y,2);

},200);

setWatch(()=>{
g.clear();
samples=[];
drawPolarAxes();
}, BTN1, {repeat:true, edge:"rising"});
