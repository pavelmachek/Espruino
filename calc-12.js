#!bin/espruino
eval(require("fs").readFile("sdl.js"));

/*
Design 12 keys calculator. It should use RPN. It should use 0-9. and enter keys.

Logic would be like this: If I'm entering number starting with, well, number, it adds the number to the stack. We will call entering empty line "C". During number input, .. means backspace, elsewhere, . is backspace. Basic operations such as +, -, *, / should be C1, C2, C3, C4. It should be possible to do more functions, for example sin() on C51.

Give me implementation for Bangle.js2. Use full screen for keyboard. During input, key labels should change according to the current state. So for example after C, "1" key should display "1+". It should be possible to record and run programs. Display should overlay input area to save space. Keys should react on release, and while key is pressed, big label of the key should be displayed in the other half of screen, so it is not covered by the finger

  */
  
// Layout definitions
const SCREEN_WIDTH = g.getWidth();
const SCREEN_HEIGHT = g.getHeight();

class CPU {
  constructor() {
    this.stack = [];
  }

  execute(cmd) {
    print("Execute?", cmd);
    if (!cmd)
      return -3;
    if (cmd[0] != "C")
      return -3;
    if (this.stack.length < 1) {
      print("Not enough stack");
      return -1;
    }
    if (cmd === "C51") {
      let a = this.stack.pop();
      this.stack.push(Math.sin(a));
      return 0;
    }
    if (this.stack.length < 2) {
      print("Not enough stack");
      return -1;
    }
    if (cmd === "C1") {
      let b = this.stack.pop();
      let a = this.stack.pop();
      this.stack.push(a + b);
      return 0;
    }
    if (cmd === "C2") {
      let b = this.stack.pop();
      let a = this.stack.pop();
      this.stack.push(a - b);
      return 0;
    }
    if (cmd === "C3") {
      let b = this.stack.pop();
      let a = this.stack.pop();
      this.stack.push(a * b);
      return 0;
    }
    if (cmd === "C4") {
      let b = this.stack.pop();
      let a = this.stack.pop();
      this.stack.push(a / b);
      return 0;
    }
    return -2;
  }
}

class Input {
  constructor() {
    this.input = "";
    this.DISPLAY_HEIGHT = 0;
    this.KEY_HEIGHT = SCREEN_HEIGHT / 4;
    this.KEY_WIDTH = SCREEN_WIDTH / 3;

    // Key definitions (3x4 grid)
    // Standard layout: 1-9, 0, Enter, and Command modifier (C)
    this.baseKeys = [
      ["7", "8", "9"],
      ["4", "5", "6"],
      ["1", "2", "3"],
      ["C", "0", "E"]
    ];
  }

  drawPreview(previewText, pos) {
    this.drawKeyboard();
    g.setFont("Vector", 60);
    g.drawString(previewText, 10, pos);
  }

  drawScreen() {
    g.reset().clear();
    
    // --- Display Area (Top) ---
    g.setColor(1, 1, 1);
    g.fillRect(0, 0, SCREEN_WIDTH, SCREEN_WIDTH);

    // --- Keyboard Area (Bottom) ---
    this.drawKeyboard();

    g.setColor(0, 0, 0);
    g.setFont("Vector", 16);
    
    {
      // Show stack items
      let stackStr = "Stk: " + cpu.stack.slice(-3).join(" ");
      g.drawString(stackStr, 5, 5);
      g.drawString("In: " + this.input, 5, 30);
    }
    
    // Draw separator line
    g.setColor(0, 0, 0);
    g.drawLine(0, this.DISPLAY_HEIGHT, SCREEN_WIDTH, this.DISPLAY_HEIGHT);  
  }

  getLabel(r, c) {
    let base = this.baseKeys[r][c];
    
    // Dynamic label changes based on state
    if (this.input && this.input[0] === "C") {
      if (base === "1") return "1+";
      if (base === "2") return "2-";
      if (base === "3") return "3*";
      if (base === "4") return "4/";
    }
    return base;
  }

  drawKeyboard() {
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 3; c++) {
        let x = c * this.KEY_WIDTH;
        let y = this.DISPLAY_HEIGHT + (r * this.KEY_HEIGHT);
        
        // Draw key box
        g.setColor(0.2, 0.2, 0.2);
        g.drawRect(x, y, x + this.KEY_WIDTH, y + this.KEY_HEIGHT);
        
        // Draw dynamic label
        g.setColor(0, 0, 0);
        g.setFont("Vector", 28);
        let label = this.getLabel(r, c);
        g.drawString(label, x + (this.KEY_WIDTH/2) - 10, y + (this.KEY_HEIGHT/2) - 10);
      }
    }
  }

  // Handle key press logic
  handleKeyPress(r, c) {
    let key = this.baseKeys[r][c];
    
    // Show preview on top half while handling
    if (r>=2)
      this.drawPreview(this.getLabel(r, c), 0);
    else
      this.drawPreview(this.getLabel(r, c), SCREEN_HEIGHT - 60);    
  }

  handleKeyRelease(r, c) {
    let key = this.baseKeys[r][c];
    print("Executing", key, "input", this.input);

    if (key >= "0" && key <= "9") {
      this.input += key;
      // Handle operations if in C mode
      if (!cpu.execute(this.input)) {
        this.input = "";
        this.drawScreen();
        return;
      }
      this.drawScreen();
      return;
    }

    if (key === "E") {
      if (this.input !== "") {
        cpu.stack.push(parseFloat(this.input));
        this.input = "";
      } else 
        this.input = "C";
    }

    if (key === "C") {
      // Backspace during input
      this.input = this.input.slice(0, -1);
    }

    // Refresh display after a short delay
    //setTimeout(() => drawScreen(), 300);
    this.drawScreen();
  }
  on_drag(xy) {
    let x = xy.x;
    let y = xy.y;
    
    if (y >= this.DISPLAY_HEIGHT) {
      let c = Math.floor(x / this.KEY_WIDTH);
      let r = Math.floor((y - this.DISPLAY_HEIGHT) / this.KEY_HEIGHT);
      if (r >= 0 && r < 4 && c >= 0 && c < 3) {
        if (xy.b)
          this.handleKeyPress(r, c);
        else
          this.handleKeyRelease(r, c);
      }
    }
  }
}

let cpu = new CPU();
let draw_input = new Input();

// Touch event listener for Bangle.js 2
Bangle.on('drag', (xy) => draw_input.on_drag(xy));

// Initial draw
draw_input.drawScreen();
