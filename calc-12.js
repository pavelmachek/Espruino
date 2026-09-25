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

class LineStore {
  constructor() {
    this.lines = [];    // sorted numeric lines
    this.values = [];   // same index as lines
  }

  set(line, value) {
    const i = this._findIndex(line);
    if (i.found) {
      this.values[i.index] = value;
    } else {
      this.lines.splice(i.index, 0, line);
      this.values.splice(i.index, 0, value);
    }
  }

  get(line) {
    const i = this._findIndex(line);
    return i.found ? this.values[i.index] : undefined;
  }

  // smallest stored line > n
  next_line(n) {
    const i = this._lowerBound(n + 1);
    return i < this.lines.length ? this.lines[i] : null;
  }

  _findIndex(line) {
    const i = this._lowerBound(line);
    return {
      index: i,
      found: i < this.lines.length && this.lines[i] === line,
    };
  }

  _lowerBound(target) {
    let lo = 0, hi = this.lines.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.lines[mid] < target) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }
}

class CPU {
  constructor() {
    this.stack = [];
  }

  run_subproc(store, line) {
    while(1) {
      print("subproc: ", line);
      cmd = store.get(line);
      print("cmd: ", cmd);
      if (cmd == "C98")
        return;
      if (this.execute(cmd)) {
        print("Error executing");
        return;
      }
    

      print("subproc: ", line);
      line = store.next_line(line);
      if (line === null)
        return;
    }
  }

  execute(cmd) {
    print("Execute?", cmd);
    if (!cmd)
      return -3;
    if (cmd[0] >= "0" && cmd[0] <= "9") {
      this.stack.push(parseFloat(cmd));
      return 0;
    }
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
    if (cmd === "C97") {
      let a = this.stack.pop();
      this.run_subproc(this.store, a);
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
      ["0", "C", "E"]
    ];
  }

  draw_over(t, x, y, size) {
    g.setColor(1, 1, 1);
    g.fillRect(x, y, x+70, y+size);
    g.setColor(0, 0, 0);
    g.setFont("Vector", size);
    g.drawString(t, 10, y);
  }

  draw_preview(t, pos) {
    this.draw_screen();
    this.draw_over(t, 10, pos, 60);
  }

  draw_screen() {
    g.reset().clear();
    
    // --- Display Area (Top) ---
    g.setColor(0.75, 1, 1);
    g.fillRect(0, 0, SCREEN_WIDTH, SCREEN_WIDTH);

    // --- Keyboard Area (Bottom) ---
    if (this.input != "")
      this.draw_keyboard();
    this.draw_boxes();

    g.setColor(0, 0, 0);
    g.setFont("Vector", 33);
    
    {
      // Show stack items
      if (this.input == "") {
        let stackStr = "" + cpu.stack.slice(-4).join("\n");
        g.drawString(stackStr, 5, 5);
      }
      if (this.input != "") {
        g.setColor(1, 1, 1);
        g.fillRect(0, SCREEN_HEIGHT - 40, SCREEN_WIDTH, SCREEN_HEIGHT);
        g.setColor(0, 0, 0);
        g.drawString("In: " + this.input, 5, SCREEN_HEIGHT - 40);
      }
    }
    
    // Draw separator line
    g.setColor(0, 0, 0);
    g.drawLine(0, this.DISPLAY_HEIGHT, SCREEN_WIDTH, this.DISPLAY_HEIGHT);  
  }

  get_label(r, c) {
    let base = this.baseKeys[r][c];
    
    // Dynamic label changes based on state
    if (this.input && this.input[0] === "C" && this.input[1] === "9") {
      if (base === "7") return "go";
      if (base === "8") return "rtn";
      return base;
    }    
    if (this.input && this.input[0] === "C" && this.input[1] === "5") {
      if (base === "1") return "sin";
      return base;
    }    
    if (this.input && this.input[0] === "C") {
      if (base === "1") return "1+";
      if (base === "2") return "2-";
      if (base === "3") return "3*";
      if (base === "4") return "4/";
      if (base === "5") return "fun";
      if (base === "9") return "pgm";
      return base;
    }
    return base;
  }

  draw_boxes() {
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 3; c++) {
        let x = c * this.KEY_WIDTH;
        let y = this.DISPLAY_HEIGHT + (r * this.KEY_HEIGHT);
        
        // Draw key box
        g.setColor(0.2, 0.2, 0.2);
        g.drawRect(x, y, x + this.KEY_WIDTH, y + this.KEY_HEIGHT);
      }
    }
  }

  draw_keyboard() {
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 3; c++) {
        let x = c * this.KEY_WIDTH;
        let y = this.DISPLAY_HEIGHT + (r * this.KEY_HEIGHT);
        
        // Draw dynamic label
        g.setColor(0, 0, 0);
        g.setFont("Vector", 28);
        let label = this.get_label(r, c);
        g.drawString(label, x + (this.KEY_WIDTH/2) - 10, y + (this.KEY_HEIGHT/2) - 10);
      }
    }
  }

  // Handle key press logic
  handleKeyPress(r, c) {
    let key = this.baseKeys[r][c];
    
    // Show preview on top half while handling
    if (r>=2)
      this.draw_preview(this.get_label(r, c), 0);
    else
      this.draw_preview(this.get_label(r, c), SCREEN_HEIGHT - 60);    
  }

  handleKeyRelease(r, c) {
    let key = this.baseKeys[r][c];
    print("Executing", key, "input", this.input);

    if (key >= "0" && key <= "9") {
      this.input += key;
      // Handle operations if in C mode
      if (this.input[0] == "C" && !cpu.execute(this.input)) {
        this.input = "";
      }
      this.draw_screen();
      return;
    }

    if (key === "E") {
      if (this.input !== "") {
        cpu.execute(this.input)
        this.input = "";
      } else 
        this.input = "C";
    }

    if (key === "C") {
      if (this.input && this.input[0] == "C") {
        // Backspace during input
        this.input = this.input.slice(0, -1);
      } else {
        if (!this.input.includes("."))
          this.input += ".";
        else
          this.input = this.input.slice(0, -2);
      }
    }

    // Refresh display after a short delay
    //setTimeout(() => draw_screen(), 300);
    this.draw_screen();
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
  on_key(v) {
    print("key down", v);
    switch (v) {
    case 79: this.handleKeyRelease(0, 0); break;
    case 80: this.handleKeyRelease(0, 1); break;
    case 81: this.handleKeyRelease(0, 2); break;
      
    case 83: this.handleKeyRelease(1, 0); break;
    case 84: this.handleKeyRelease(1, 1); break;
    case 85: this.handleKeyRelease(1, 2); break;
      
    case 87: this.handleKeyRelease(2, 0); break;
    case 88: this.handleKeyRelease(2, 1); break;
    case 89: this.handleKeyRelease(2, 2); break;

    case 90: this.handleKeyRelease(3, 0); break;
    case 91: this.handleKeyRelease(3, 1); break;
    case 104: this.handleKeyRelease(3, 2); break;
    }
    
  }
}

let cpu = new CPU();
let draw_input = new Input();
let store = new LineStore();
cpu.store = store;

store.set(10, "1");
store.set(20, "C1");
store.set(30, "C98");

cpu.run_subproc(store, 10);

// Touch event listener for Bangle.js 2
Bangle.on('drag', (xy) => draw_input.on_drag(xy));
Bangle.on('key', (xy) => draw_input.on_key(xy));

// Initial draw
draw_input.draw_screen();
