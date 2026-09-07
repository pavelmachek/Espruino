#!bin/espruino
eval(require("fs").readFile("sdl.js"));

/*
Design 12 keys calculator. It should use RPN. It should use 0-9. and enter keys.

Logic would be like this: If I'm entering number starting with, well, number, it adds the number to the stack. We will call entering empty line "C". During number input, .. means backspace, elsewhere, . is backspace. Basic operations such as +, -, *, / should be C1, C2, C3, C4. It should be possible to do more functions, for example sin() on C51.

Give me implementation for Bangle.js2. Use full screen for keyboard. During input, key labels should change according to the current state. So for example after C, "1" key should display "1+". It should be possible to record and run programs. Display should overlay input area to save space. Keys should react on release, and while key is pressed, big label of the key should be displayed in the other half of screen, so it is not covered by the finger

  */
  
// RPN Calculator for Bangle.js 2
// State variables
let stack = [];
let currentInput = "";
let mode = "NORMAL"; // NORMAL, C, C5
let recording = false;
let macro = [];

// Layout definitions
const SCREEN_WIDTH = g.getWidth();
const SCREEN_HEIGHT = g.getHeight();
const DISPLAY_HEIGHT = 0;
const KEY_HEIGHT = SCREEN_HEIGHT / 4;
const KEY_WIDTH = SCREEN_WIDTH / 3;

// Key definitions (3x4 grid)
// Standard layout: 1-9, 0, Enter, and Command modifier (C)
const baseKeys = [
  ["7", "8", "9"],
  ["4", "5", "6"],
  ["1", "2", "3"],
  ["C", "0", "ENT"]
];

function drawPreview(previewText, pos) {
  g.reset().clear();

  //drawKeyboard();
  
  g.setFont("Vector", 60);
  g.drawString(previewText, 10, pos);
}

function drawScreen() {
  g.reset().clear();
  
  // --- Display Area (Top) ---
  g.setColor(1, 1, 1);
  g.fillRect(0, 0, SCREEN_WIDTH, SCREEN_WIDTH);

  // --- Keyboard Area (Bottom) ---
  drawKeyboard();

  g.setColor(0, 0, 0);
  g.setFont("Vector", 16);
  
 {
    // Show stack items
    let stackStr = "Stk: " + stack.slice(-3).join(" ");
    g.drawString(stackStr, 5, 5);
    g.drawString("In: " + currentInput, 5, 30);
    g.drawString("Mode: " + mode, 5, 55);
  }
  
  // Draw separator line
  g.setColor(0, 0, 0);
  g.drawLine(0, DISPLAY_HEIGHT, SCREEN_WIDTH, DISPLAY_HEIGHT);
  
}

function getLabel(r, c) {
  let base = baseKeys[r][c];
  
  // Dynamic label changes based on state
  if (mode === "C") {
    if (base === "1") return "1+";
    if (base === "2") return "2-";
    if (base === "3") return "3*";
    if (base === "4") return "4/";
  }
  return base;
}

function drawKeyboard() {
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 3; c++) {
      let x = c * KEY_WIDTH;
      let y = DISPLAY_HEIGHT + (r * KEY_HEIGHT);
      
      // Draw key box
      g.setColor(0.2, 0.2, 0.2);
      g.drawRect(x, y, x + KEY_WIDTH, y + KEY_HEIGHT);
      
      // Draw dynamic label
      g.setColor(0, 0, 0);
      g.setFont("Vector", 28);
      let label = getLabel(r, c);
      g.drawString(label, x + (KEY_WIDTH/2) - 10, y + (KEY_HEIGHT/2) - 10);
    }
  }
}

// Handle key press logic
function handleKeyPress(r, c) {
  let key = baseKeys[r][c];
  
  // Show preview on top half while handling
  if (r>=2)
    drawPreview(getLabel(r, c), 0);
  else
    drawPreview(getLabel(r, c), SCREEN_HEIGHT - 60);    
}

function execute(cmd) {
  print("Execute?", cmd);
  if (!cmd)
    return -3;
  if (cmd[0] != "C")
    return -3;
  if (stack.length < 2) {
    print("Not enough stack");
    return -1;
  }
  let b = stack.pop();
  let a = stack.pop();
  if (cmd === "C1") {
    stack.push(a + b);
    return 0;
  }
  if (cmd === "C2") {
    stack.push(a - b);
    return 0;
  }
  if (cmd === "C3") {
    stack.push(a * b);
    return 0;
  }
  if (cmd === "C4") {
    stack.push(a / b);
    return 0;
  }
  return -2;
}

function handleKeyRelease(r, c) {
  let key = baseKeys[r][c];
  print("Executing", key, "input", currentInput);

  if (key >= "0" && key <= "9") {
    if (mode === "C5") {
      // Extended functions e.g., C51 for sin()
      if (key === "1") { // C51 -> sin()
        if (stack.length > 0) {
          let val = stack.pop();
          stack.push(Math.sin(val));
        }
      }
      mode = "NORMAL";
      return;
    }
    currentInput += key;
      // Handle operations if in C mode
  if (!execute(currentInput)) {
    currentInput = "";
    mode = "NORMAL";
    drawScreen();
    return;
  }
    drawScreen();
    return;
  }

  if (key === "ENT") {
    if (currentInput !== "") {
      stack.push(parseFloat(currentInput));
      currentInput = "";
      return;
    }
    currentInput = "C";
    return;
  }

  if (key === "C") {
    if (currentInput === "") {
      mode = (mode === "C") ? "NORMAL" : "C";
    } else {
      // Backspace during input
      currentInput = currentInput.slice(0, -1);
    }
  }

  // Refresh display after a short delay
  //setTimeout(() => drawScreen(), 300);
  drawScreen();
}

// Touch event listener for Bangle.js 2
Bangle.on('drag', function(xy) {
  let x = xy.x;
  let y = xy.y;
  
  if (y >= DISPLAY_HEIGHT) {
    let c = Math.floor(x / KEY_WIDTH);
    let r = Math.floor((y - DISPLAY_HEIGHT) / KEY_HEIGHT);
    if (r >= 0 && r < 4 && c >= 0 && c < 3) {
      if (xy.b)
        handleKeyPress(r, c);
      else
        handleKeyRelease(r, c);
    }
  }
});

// Initial draw
drawScreen();
