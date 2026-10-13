#!bin/espruino
eval(require("fs").readFile("sdl.js"));

// CHIP-8 Implementation for Bangle.js 2
const CHIP8 = {
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

  // Map Bangle.js 2 button to CHIP-8 keys (Simplified)
  // In a real game, you'd need a more complex input map
  initInput: function() {
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
    let opcode = (this.memory[this.pc] << 8) | this.memory[this.pc + 1];
    this.pc += 2;

    let x = (opcode & 0x0F00) >> 8;
    let y = (opcode & 0x00F0) >> 4;
    let n = (opcode & 0x00FF);
    let nn = (opcode & 0x0FF0) >> 4;
    let nnn = (opcode & 0x0FFF);

    switch (opcode & 0xF000) {
      case 0x0000:
        if (opcode === 0x00E0) this.display.fill(0); // CLS
        else if (opcode === 0x00EE) { this.pc = this.stack[--this.sp]; } // RET
        break;
      case 0x1000: this.pc = nnn; break; // JMP
      case 0x2000: this.stack[this.sp++] = this.pc; this.pc = nnn; break; // CALL
      case 0x3000: if (this.v[x] === n) this.pc += 2; break; // SE VX, byte
      case 0x4000: if (this.v[x] !== n) this.pc += 2; break; // SNE VX, byte
      case 0x6000: this.v[x] = n; break; // LD VX, byte
      case 0x7000: this.v[x] += n; break; // ADD VX, byte
      case 0x8000:
        // Simplified arithmetic examples
        if ((opcode & 0x000F) === 0x0) this.v[x] = this.v[y];
        break;
      case 0x9000: if (this.v[x] !== this.v[y]) this.pc += 2; break;
      case 0xA000: this.i = nnn; break; // LD I, addr
      case 0xC000: this.v[x] = Math.floor(Math.random() * 256); break; // RND VX
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
        break;
    }
  },

  render: function() {
    g.clear();
    g.setColor(1, 1, 1);
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

// Main Loop
setInterval(() => {
  for(let i=0; i<10; i++) CHIP8.step();
  CHIP8.render();
}, 1000/60);
