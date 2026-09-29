#!bin/espruino

/*

  Bangle.js2, give me code to read png file and display it on the screen. Note that a) you only have 8 colors, b) you can't use any libraries; do decoding by hand. Assume small files, and it is okay if debugging takes a while. Use classes to group code where it makes sense.
  
  Hmm. 25 seconds for 48x12 picture.
 */

var pc = 1;
if (pc)
  eval(require("fs").readFile("sdl.js"));

class BitReader {
  constructor(u8, pos) {
    this.u8 = u8;
    this.pos = pos || 0;
    this.bitBuf = 0;
    this.bitCount = 0;
  }
  readBits(n) {
    while (this.bitCount < n) {
      this.bitBuf |= this.u8[this.pos++] << this.bitCount;
      this.bitCount += 8;
    }
    const v = this.bitBuf & ((1 << n) - 1);
    this.bitBuf >>= n;
    this.bitCount -= n;
    return v;
  }
  alignByte() {
    this.bitBuf = 0;
    this.bitCount = 0;
  }
}

class Huffman {
  constructor(lengths) {
    this.maxBits = 0;
    for (let i = 0; i < lengths.length; i++) if (lengths[i] > this.maxBits) this.maxBits = lengths[i];

    const blCount = [];
    const nextCode = [];
    for (let i = 0; i <= this.maxBits; i++) blCount[i] = 0;
    for (let i = 0; i < lengths.length; i++) if (lengths[i]) blCount[lengths[i]]++;

    let code = 0;
    blCount[0] = 0;
    for (let bits = 1; bits <= this.maxBits; bits++) {
      code = (code + (blCount[bits - 1] || 0)) << 1;
      nextCode[bits] = code;
    }

    this.table = {};
    for (let n = 0; n < lengths.length; n++) {
      const len = lengths[n];
      if (!len) continue;
      const c = nextCode[len]++;
      const rev = Huffman.reverseBits(c, len);
      this.table[len + ":" + rev] = n;
    }
  }

  static reverseBits(x, len) {
    let r = 0;
    for (let i = 0; i < len; i++) {
      r = (r << 1) | (x & 1);
      x >>>= 1;
    }
    return r;
  }

  decode(br) {
    let code = 0;
    for (let len = 1; len <= this.maxBits; len++) {
      code |= br.readBits(1) << (len - 1);
      const v = this.table[len + ":" + code];
      if (v !== undefined) return v;
    }
    throw new Error("Bad Huffman code");
  }
}

class Inflate {
  static inflate(zbytes) {
    const br = new BitReader(zbytes, 2); // skip zlib header
    let out = [];

    let final = 0;
    while (!final) {
      final = br.readBits(1);
      const btype = br.readBits(2);
      print("Inflate", br.pos, zbytes.length);

      if (btype === 0) {
        br.alignByte();
        const p = br.pos;
        const len = zbytes[p] | (zbytes[p+1] << 8);
        const nlen = zbytes[p+2] | (zbytes[p+3] << 8);
        br.pos += 4;
        if (((len ^ 0xFFFF) & 0xFFFF) !== nlen) throw new Error("Stored block length mismatch");
        for (let i = 0; i < len; i++) out.push(zbytes[br.pos++]);
      } else if (btype === 1 || btype === 2) {
        const v = Inflate.buildHuffmanTables(btype, br, zbytes);
        const litLen = v.litLen;
        const dist = v.dist;
        while (true) {
          const sym = litLen.decode(br);
          if (sym < 256) {
            out.push(sym);
          } else if (sym === 256) {
            break;
          } else if (sym > 256 && sym < 286) {
            const lenInfo = Inflate.lengthFromSymbol(sym);
            const extraLen = lenInfo.extra ? br.readBits(lenInfo.extra) : 0;
            const length = lenInfo.base + extraLen;

            const distSym = dist.decode(br);
            const distInfo = Inflate.distanceFromSymbol(distSym);
            const extraDist = distInfo.extra ? br.readBits(distInfo.extra) : 0;
            const distance = distInfo.base + extraDist;

            const start = out.length - distance;
            for (let i = 0; i < length; i++) out.push(out[start + i]);
          } else {
            throw new Error("Bad literal/length symbol");
          }
        }
      } else {
        throw new Error("Unsupported DEFLATE block type");
      }
    }

    return new Uint8Array(out);
  }

  static buildHuffmanTables(btype, br, zbytes) {
    let litLenLens = [];
    let distLens = [];

    if (btype === 1) {
      for (let i = 0; i < 288; i++) {
        if (i <= 143) litLenLens[i] = 8;
        else if (i <= 255) litLenLens[i] = 9;
        else if (i <= 279) litLenLens[i] = 7;
        else litLenLens[i] = 8;
      }
      for (let i = 0; i < 32; i++) distLens[i] = 5;
    } else {
      const HLIT = br.readBits(5) + 257;
      const HDIST = br.readBits(5) + 1;
      const HCLEN = br.readBits(4) + 4;

      const order = [16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];
      const codeLenLens = [];
      for (let i = 0; i < 19; i++) codeLenLens[i] = 0;
      for (let i = 0; i < HCLEN; i++) codeLenLens[order[i]] = br.readBits(3);

      const codeLenHuff = new Huffman(codeLenLens);

      const lengths = [];
      let i = 0;
      while (i < HLIT + HDIST) {
        const sym = codeLenHuff.decode(br);
        if (sym <= 15) {
          lengths[i++] = sym;
        } else if (sym === 16) {
          const repeat = br.readBits(2) + 3;
          const prev = lengths[i - 1] || 0;
          for (let r = 0; r < repeat; r++) lengths[i++] = prev;
        } else if (sym === 17) {
          const repeat = br.readBits(3) + 3;
          for (let r = 0; r < repeat; r++) lengths[i++] = 0;
        } else if (sym === 18) {
          const repeat = br.readBits(7) + 11;
          for (let r = 0; r < repeat; r++) lengths[i++] = 0;
        } else {
          throw new Error("Bad code length symbol");
        }
      }

      litLenLens = lengths.slice(0, HLIT);
      distLens = lengths.slice(HLIT, HLIT + HDIST);
    }

    if (btype === 1) {
      return { litLen: new Huffman(litLenLens), dist: new Huffman(distLens) };
    } else {
      return {
        litLen: new Huffman(litLenLens),
        dist: new Huffman(distLens.length ? distLens : [0,5]) // fallback-ish
      };
    }
  }

  static lengthFromSymbol(sym) {
    const table = [
      [257,3,0],[258,4,0],[259,5,0],[260,6,0],[261,7,0],[262,8,0],[263,9,0],[264,10,0],
      [265,11,1],[266,13,1],[267,15,1],[268,17,1],[269,19,2],[270,23,2],[271,27,2],[272,31,2],
      [273,35,3],[274,43,3],[275,51,3],[276,59,3],[277,67,4],[278,83,4],[279,99,4],[280,115,4],
      [281,131,5],[282,163,5],[283,195,5],[284,227,5],[285,258,0]
    ];
    const e = table[sym - 257];
    return { base: e[1], extra: e[2] };
  }

  static distanceFromSymbol(sym) {
    const table = [
      [0,1,0],[1,2,0],[2,3,0],[3,4,0],[4,5,1],[5,7,1],[6,9,2],[7,13,2],
      [8,17,3],[9,25,3],[10,33,4],[11,49,4],[12,65,5],[13,97,5],[14,129,6],[15,193,6],
      [16,257,7],[17,385,7],[18,513,8],[19,769,8],[20,1025,9],[21,1537,9],[22,2049,10],[23,3073,10],
      [24,4097,11],[25,6145,11],[26,8193,12],[27,12289,12],[28,16385,13],[29,24577,13]
    ];
    const e = table[sym];
    if (!e) throw new Error("Bad distance symbol");
    return { base: e[1], extra: e[2] };
  }
}

class PNG {
  constructor(arrayBuffer) {
    this.u8 = new Uint8Array(arrayBuffer);
    this.pos = 0;
    this.width = 0;
    this.height = 0;
    this.bitDepth = 0;
    this.colorType = 0;
    this.palette = [];
    this.idat = [];
    this.parse();
  }

  readU8() { return this.u8[this.pos++]; }
  readU32BE() { return ((this.readU8()<<24) | (this.readU8()<<16) | (this.readU8()<<8) | this.readU8()) >>> 0; }
  readBytes(n) { const b = this.u8.subarray(this.pos, this.pos+n); this.pos += n; return b; }
  readString(n) { let s=""; for (let i=0;i<n;i++) s += String.fromCharCode(this.readU8()); return s; }

  parse() {
    const sig = [137,80,78,71,13,10,26,10];
    for (let i = 0; i < sig.length; i++) if (this.readU8() !== sig[i]) throw new Error("Not PNG");

    while (this.pos < this.u8.length) {
      const len = this.readU32BE();
      const type = this.readString(4);
      const data = this.readBytes(len);
      this.readU32BE();
      //print("Have type", type);
      if (type === "IHDR") this.parseIHDR(data);
      else if (type === "PLTE") this.parsePLTE(data);
      else if (type === "IDAT") this.idat.push(data);
      else if (type === "IEND") break;
    }
  }

  parseIHDR(d) {
    this.width = (d[0]<<24)|(d[1]<<16)|(d[2]<<8)|d[3];
    this.height = (d[4]<<24)|(d[5]<<16)|(d[6]<<8)|d[7];
    this.bitDepth = d[8];
    this.colorType = d[9];
    this.compression = d[10];
    this.filter = d[11];
    this.interlace = d[12];
    print("Have header:", this.width, "x", this.height, "depth", this.bitDepth);
    this.height = this.height;
  }

  parsePLTE(d) {
    this.palette = [];
    for (let i = 0; i < d.length; i += 3) this.palette.push([d[i], d[i+1], d[i+2]]);
  }

  concatIDAT() {
    let total = 0;
    for (let i = 0; i < this.idat.length; i++) total += this.idat[i].length;
    let out = new Uint8Array(total);
    let p = 0;
    for (let i = 0; i < this.idat.length; i++) { out.set(this.idat[i], p); p += this.idat[i].length; }
    return out;
  }

  paeth(a,b,c) {
    const p = a + b - c;
    const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
  }

  unfilter(raw, bpp) {
    const stride = this.width * bpp;
    const out = new Uint8Array(this.height * stride);
    let ip = 0, op = 0;
    for (let y = 0; y < this.height; y++) {
      const f = raw[ip++];
      for (let x = 0; x < stride; x++) {
        const cur = raw[ip++];
        //print(cur);
        const left = x >= bpp ? out[op + x - bpp] : 0;
        const up = y ? out[op + x - stride] : 0;
        const upLeft = (y && x >= bpp) ? out[op + x - stride - bpp] : 0;
        let v = cur;
        if (f === 1) v = (cur + left) & 255;
        else if (f === 2) v = (cur + up) & 255;
        else if (f === 3) v = (cur + ((left + up) >> 1)) & 255;
        else if (f === 4) v = (cur + this.paeth(left, up, upLeft)) & 255;
        else if (f !== 0) {
          print("Filter: ", f);
          throw new Error("Bad filter");
        }
        out[op + x] = v;
      }
      op += stride;
    }
    return out;
  }

  toBangleColor(r, g, b) {
    const p = [
      [0,0,0],[255,255,255],[255,0,0],[0,255,0],
      [0,0,255],[255,255,0],[0,255,255],[255,0,255]
    ];
    let ret = [0,0,0];
    ret[0] = r / 256;
    ret[1] = g / 256;
    ret[2] = b / 256;
    return ret;
    let best = 0, bestD = 1e9;
    for (let i = 0; i < p.length; i++) {
      const dr = r - p[i][0], dg = g - p[i][1], db = b - p[i][2];
      const d = dr*dr + dg*dg + db*db;
      if (d < bestD) { bestD = d; best = i; }
    }
    return p[best];
  }

  draw(g, x, y, sc) {
    const z = this.concatIDAT();
          print("Inflate");
    const raw = Inflate.inflate(z);

    print("colortype", this.colorType);
    
    let bpp;
    if (this.colorType === 3) bpp = 1;
    else if (this.colorType === 2) bpp = 3;
    else if (this.colorType === 6) bpp = 4;
    else throw new Error("Only indexed or truecolor PNG supported");

//    print("Palette:", this.palette);
    print("Raw:", raw.length);

    px = raw;
    //const px = this.unfilter(raw, bpp);
    const out = [];

    print("Color convert");

    // FIXME: for 4-bit indexed
    if (this.bitDepth == 4 && this.colorType === 3) {
      let i = 0;
      for (let yy = 0; yy < this.height; yy++) {
        for (let xx = 0; xx < this.width; xx++) {
          // FIXME: we should work with nibbles, not take every second like this
          const c = this.palette[px[i >> 1] & 0x0f] || [0, 0, 0];
          let color = this.toBangleColor(c[0], c[1], c[2]);
          
          g.setColor(color[0], color[1], color[2]);
          g.fillRect(x + xx*sc, y + yy*sc, x + xx*sc + sc-1, y + yy*sc + sc-1);
          i++;
        }
        i+=2;
      }
      return;
    }

    if (this.colorType === 2) {
      throw new Error("RGB should be similar to RGBA");
    }
      
    if (this.colorType === 6) {
      let i = 0;
      for (let yy = 0; yy < this.height; yy++) {
        for (let xx = 0; xx < this.width; xx++) {
          let color = this.toBangleColor(px[i], px[i+1], px[i+2]);
          g.setColor(color[0], color[1], color[2]);

          g.fillRect(x + xx*sc, y + yy*sc, x + xx*sc + sc-1, y + yy*sc + sc-1);
          i+=4;
        }
        i+=2;
      }
      return;
    }

    if (this.bitDepth == 8 && this.colorType === 3) {
      let i = 0;
      for (let yy = 0; yy < this.height; yy++) {
        for (let xx = 0; xx < this.width; xx++) {
          const c = this.palette[px[i]] || [0, 0, 0];
          let color = this.toBangleColor(c[0], c[1], c[2]);
          
          g.setColor(color[0], color[1], color[2]);
          g.fillRect(x + xx*sc, y + yy*sc, x + xx*sc + sc-1, y + yy*sc + sc-1);
          i++;
        }
        i+=1;
      }
      return;
    }
  }
}

function test() {
  let t1=getTime();
  print("Read");
  let s;
  if (!pc)
     s = require("Storage").read("delme.png");
  else {
    if (1)
      s = require("fs").readFile("/fast/pavel/g/tui/bwatch/apps/tetris/tetris.png");
    else if (0)
      s = require("fs").readFile("/usr/share/eom/icons/hicolor/48x48/actions/slideshow-play.png");
    else
      s = require("fs").readFile("/fast/pavel/Maps/OSM/10/576/331.png")
  }
  const a = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i) & 255;
  print("De-png");
  png = new PNG(a.buffer);
  png.draw(g, 0, 0, 1);
  print("Done", getTime()-t1)
}

setTimeout(test, 1000);

