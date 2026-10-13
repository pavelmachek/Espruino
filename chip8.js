#!bin/espruino

eval(require("fs").readFile("sdl.js"));

const fs = require("fs");

// CHIP-8 Implementation for Bangle.js 2
let CHIP8 = {
  memory: new Uint8Array(4096),
  v: new Uint8Array(16),
  i: 0, pc: 0x200, sp: 0,
  delayTimer: 0, soundTimer: 0,
  stack: new Uint16Array(16),
  display: new Uint8Array(64 * 32),
  
  // Load a ROM into memory starting at 0x200
  loadROM: function(data) {
    for (let i = 0; i < data.length; i++) {
      this.memory[0x200 + i] = data[i];
    }
  },

  // NEW: Load ROM from Bangle.js 2 filesystem
  loadROMFromFile: function(path) {
    try {
      console.log("Loading ROM: " + path);
      let data = fs.readFileSync(path, "binary");
      
      if (data.length > (4096 - 0x200)) {
        throw new Error("ROM too large for memory");
      }

      for (let i = 0; i < data.length; i++) {
        let v =  data.charCodeAt(i)
        print(i, v);
        this.memory[0x200 + i] = v;
      }
      console.log("ROM loaded successfully. Size: " + data.length + " bytes");
      return true;
    } catch (e) {
      console.log("Error loading ROM: " + e.message);
      return false;
    }
  },

  // Map Bangle.js 2 button to CHIP-8 keys (Simplified)
  // In a real game, you'd need a more complex input map
  initInput: function() {
    return;
    setWatch(() => {
      // Example: Map the physical button to CHIP-8 key 0x0
      this.keys[0x0] = true;
    }, BTN, {edge:"rising", repeat:true});
    setWatch(() => {
      this.keys[0x0] = false;
    }, BTN, {edge:"falling", repeat:true});
  },

  step: function() {
    // Fetch 2-byte opcode
    //    let opcode = (this.memory[this.pc + 1] << 8) | this.memory[this.pc];
        let opcode = (this.memory[this.pc] << 8) | this.memory[this.pc+1];
    print("pc", this.pc.toString(16), "opcode", opcode.toString(16));
    this.pc += 2;

    let x = (opcode & 0x0F00) >> 8;
    let y = (opcode & 0x00F0) >> 4;
    let n = (opcode & 0x00FF);
    let nn = (opcode & 0x0FF0) >> 4;
    let nnn = (opcode & 0x0FFF);
    let debug = 0;

    switch (opcode & 0xF000) {
    case 0x0000:
      if (opcode === 0x00E0) this.display.fill(0); // CLS
      else if (opcode === 0x00EE) { this.pc = this.stack[--this.sp]; } // RET
      else print("op0xxx: unknown parameter");
      break;
    case 0x1000: this.pc = nnn; break; // JMP
    case 0x2000: this.stack[this.sp++] = this.pc; this.pc = nnn; break; // CALL
    case 0x3000: if (this.v[x] === n) this.pc += 2; break; // SE VX, byte
    case 0x4000: if (this.v[x] !== n) this.pc += 2; break; // SNE VX, byte
    case 0x6000: this.v[x] = n; break; // LD VX, byte
    case 0x7000: this.v[x] += n; break; // ADD VX, byte
    case 0x8000:
      let mode = opcode & 0x000F; // Extract the last 4 bits
      
      switch (mode) {
      case 0x0: // 8xy0: Set VX = VY
        this.v[x] = this.v[y];
        break;

      case 0x1: // 8xy1: Set VX = VX OR VY
        this.v[x] = this.v[x] | this.v[y];
        break;

      case 0x2: // 8xy2: Set VX = VX AND VY
        this.v[x] = this.v[x] & this.v[y];
        break;

      case 0x3: // 8xy3: Set VX = VX XOR VY
        this.v[x] = this.v[x] ^ this.v[y];
        break;

      case 0x4: // 8xy4: Set VX = VX + VY
        // Handle carry manually because Uint8Array wraps automatically
        let sum = this.v[x] + this.v[y];
        this.v[0x0F] = (sum > 255) ? 1 : 0;
        this.v[x] = sum & 0xFF; // Keep it 8-bit
        break;

      case 0x5: // 8xy5: Set VX = VX - VY
        // If VX >= VY, VF = 1 (no borrow), else VF = 0 (borrow)
        this.v[0x0F] = (this.v[x] >= this.v[y]) ? 1 : 0;
        this.v[x] = this.v[x] - this.v[y]; 
        // Uint8Array handles the underflow wrap (e.g., 0 - 1 = 255)
        break;

      case 0x6: // 8xy6: Set VX = byte, VF = (VX AND VY) == 0
        // Shift the value of VY into VX, then check if they share no bits
        let oldVx = this.v[x];
        this.v[x] = this.v[y];
        this.v[0x0F] = ((oldVx & this.v[y]) === 0) ? 1 : 0;
        break;

      case 0x7: // 8xy7: Set VY = VY XOR (VX AND VY)
        // This is effectively "clear bits in VY that are also set in VX"
        this.v[y] = this.v[y] ^ (this.v[x] & this.v[y]);
        break;

      case 0x8: // 8xy8: Set VX = VY (Same as 0x0)
        this.v[x] = this.v[y];
        break;

      case 0xE: // 8xyE: Shift VX left by VY (Shift VY is usually just 1)
        // Note: Some ROMs use VF to store the bit shifted out
        this.v[0x0F] = (this.v[x] & 0x80) ? 1 : 0;
        this.v[x] = (this.v[x] << this.v[y]) & 0xFF;
        break;

      case 0xF: // 8xyF: Shift VX right by VY
        this.v[0x0F] = (this.v[x] & 0x01) ? 1 : 0;
        this.v[x] = (this.v[x] >> this.v[y]) & 0xFF;
        break;
      }
      break;

      case 0x9000: if (this.v[x] !== this.v[y]) this.pc += 2; break;
      case 0xA000: this.i = nnn; break; // LD I, addr
      case 0xC000: this.v[x] = Math.floor(Math.random() * 256) & nnn; break; // RND VX
      case 0xD000: // Draw sprite
        this.v[0x0F] = 0;
        for (let row = 0; row < (opcode & 0x000F); row++) {
          let spriteByte = this.memory[this.i + row];
          for (let col = 0; col < 8; col++) {
            if ((spriteByte & (0x80 >> col)) !== 0) {
              let px = (this.v[x] + col) % 64;
              let py = (this.v[y] + row) % 32;
              if (this.display[px + py * 64]) this.v[0x0F] = 1;
              this.display[px + py * 64] ^= 1;
            }
          }
        }
        break;
      case 0xF000:
        if (n === 0x07) this.v[x] = this.delayTimer;
        else if (n === 0x15) this.delayTimer = this.v[x];
        else print("opFxxx: unknown parameter");
        break;
    }
  },

  render: function() {
    g.reset().clear();
    g.setColor(0, 0, 0);
    for (let i = 0; i < 64 * 32; i++) {
      if (this.display[i]) {
        // Scale up for Bangle.js 2 screen (which is usually 160x160)
        let x = i % 64;
        let y = Math.floor(i / 64);
        g.fillRect(x * 2, y * 2, 2, 2);
      }
    }
    g.flip();
  }
};

print("Init");
// 1. Initialize Input
CHIP8.initInput();

print("Load");
// 2. Load the specific file
// https://beyondloom.com/octo/ide.html Example | gradsim:
// way too complex, contains superchip code.
//const romPath = "gradsim.ch8";
const romPath = "default.ch8";
if (CHIP8.loadROMFromFile(romPath)) {
  // 3. Start the emulation loop only if load was successful
  setInterval(() => {
    for(let i=0; i<10; i++) CHIP8.step();
    CHIP8.render();
    
    // Handle timers (60Hz)
    if (CHIP8.delayTimer > 0) CHIP8.delayTimer--;
    if (CHIP8.soundTimer > 0) {
      CHIP8.soundTimer--;
      Bangle.beep();
    }
  }, 1000);
} else {
  g.clear();
  g.setColor(1,0,0);
  g.drawString("ROM Load Failed", 10, 10);
  g.flip();
}
