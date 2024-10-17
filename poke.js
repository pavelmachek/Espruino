
print("Hello world");

print(peek8(0x1234));
poke8(0xdead, 0x42);

eval("a=1");
print("a=", a);

print(require("Storage").read("poke.js"))
print(require("fs").readFile("poke.js"))
