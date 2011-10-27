var d = require('../decon');
var struct = d.struct;
var literal = d.literal;
var union = d.union;
var char = d.char;
var byte = d.byte;
var sbyte = d.sbyte;
var bool = d.bool;
var int8 = d.int8;
var int16 = d.int16;
var int32 = d.int32;
var int64 = d.int64;
var uint8 = d.uint8;
var uint16 = d.uint16;
var uint32 = d.uint32;
var uint64 = d.uint64;
var float32 = d.float32;
var float64 = d.float64;
var cstring = d.cstring;
var string = d.string;
var NULL = d.null;

var Test1 = struct({
  f1: char.array(5).equals("#abcd"),
  e: char,
  f: char,
  g: char,
  h: char,
  i: char.equals("i"),
  _: char.array(5),
  f2: char.array(10),
  nada: struct({
    bool: bool,
    null: NULL
  }).array(2)
});


var Test2 = struct({
  a:  int8.at(1).littleendian().equals(ord('a')),
  a_: int8.at(1).bigendian().equals(ord('a')),
  //ba: int16.at(1).littleendian().equals(ord('ab', false)),
  //ab: int16.at(1).bigendian().equals(ord('ab', true)),
  //dcba: int32.at(1).littleendian().equals(ord('dcba')),
  //abcd: int32.at(1).bigendian().equals(ord('abcd'))
});


var terminator = 'T';
var TString = char.array({through: terminator});
var Test3 = struct({
  _1: char.array({before: 'L'}),
  _2: "LMNOP",
  Q: char,
  totee: TString.equals("RST"),
}).check(function() { return this.Q == "Q" });


var Word = byte.signed().size(16);
var Big = struct({ word: Word }).bigendian();
var Little = struct({ word: Word }).littleendian();
var Test4 = struct({
  _: byte.array({before: 1}),
  little: Little,
  big: Big,
});

 
var Test5 = struct({
  _1: string({through: "["}),
  one: string({before: ']'}),
  apple: string(2),
  two: string({through: 'o'}),
  closebracket: char,
  _2: literal("[three]"),
  ok: "OK"
});


var String5 = string(5);
var Test6 = struct({
  reprise: String5.at(0),
  thing1: byte,
  thing2: byte.equals(function(s){ return s.thing1 + 1;}),
  things: struct({b: byte.equals(function(c){ return c.thing1 + 2 + c.N;}).
                  array({length: 2, index:"N"}) })
});


var Test7 = struct({
  _1: byte.equals(ord('#')),
  _2: uint8.equals(ord('a')),
  _3: uint16.equals(ord('bc')),
  _4: uint32.equals(ord('defg')),
  _5: uint64,//.equals(ord('hijklmno')),
  _6: sbyte.equals(ord('p')),
  _7: int8.equals(ord('q')),
  _8: int16.equals(ord('rs')),
  _9: char.array({until: '#'}),
  _10: int32.equals(ord('ABCD')),
  _11: int64,//.equals(ord('EFGHIJKL')),
  mmmmhmmm: char
});


var Test8 = struct({
  pound: char,
  a: char,
  b: char,
}).select("pound").equals("#");


var Test9 = union([
  char.check(function(){return 1 == 2;}),
  literal("N"),
  char.if(function () {return 4 == 5}),
  struct ({_: NULL.check(true), should: string(2) }),
  struct ({wontgethere: "#abc"}),
]).equals({"should":"#a"});

// Recursive def'n
var Test10 = d.ref("Test10", union([
  struct({_: "#", pound: d.ref("Test10") }),
  struct({a: "a"})
]));
 
var Test11 = struct({
  key1: char,
  value1: char,
  key2: char,
  value2: char,
});


var Test12 = char.check(function () { return this == "#";});


var Test13 = byte.array(3).equals([ord('#'), ord('a'), ord('b')]);


var Test14 = struct({ 
  _: char.array({through: 'z'}),
  newline: char.equals("\n")
});


var Test15 = struct({
  _: char.array({through: '>'}),
  ahornc: char,
  ahornb: byte,
  i16: int16,
  u16: uint16,
  i32: int32,
  u32: uint32,
  i64: int64,
  u64: uint64
});

function double() {
  return this + this;
}
function triplethis() {
  return this + this + this;
}

var Test16 = struct({
  _: char,
  abcabc: string(3).select(double).equals("abcabc"),
  de3: char.array(2).select(triplethis).equals("dedede")
});


var OtherType = struct({ 
  threeStrings: char.array(3).array(3),
  _: byte.array()
});
var Test17 = struct({
  another: OtherType.reconstruct("ZYXWandetc"),
});


function thebits() {
  var r = [];
  for (var i = 7; i >= 0; --i)
    r.push(this >> i & 1);
  return r;
}
function thenibbles() {
  return [this >> 4, this & 0xf];
}


var bit = byte.size(1);
var nibble = byte.size(4);
var Test18 = struct({
  bpound: byte.at(0).select(thebits),
  pound: bit.array(8).at(0).equals(function(s){return s.bpound}),
  na: byte.at(1).select(thenibbles),
  a: nibble.array(2).at(1).equals(function(s){return s.na})
});

var Test19 = struct({
  somebits: bit.array(8).array(8).array(2),
  pos: d.insert(function(s){return s.position}).equals(16)
});

var Test20 = struct({
  _1: char.array(10).cast(char.array({until: 'c'})).equals("#ab"),
  _2: char.array(10).cast(char.array({until: 'm'})).equals("jkl"),
  hello1: d.insert("hello\000\000\000"),
  hello: d.insert("hello\000\000\000").cast(cstring).equals("hello")
});


var Test21 = union([
  char.array(1).if(false),
  char.array(2).if(function(){return ""+this === "xy"}),
  char.array(3).if(function(){return ""+this === "#ab"}),
  char.array(4)
]).equals("#ab");


var Test22 = struct({
  le32: float32.littleendian().reconstruct([0,0,0x80,0x3f]).equals(1),
  le32a: float32.littleendian().reconstruct("\x00\x00\x80\x3f").equals(1),
  be32: float32.bigendian().reconstruct([0x3f,0x80,0,0]).equals(1),
  le64: float64.littleendian().reconstruct("\x55\x55\x55\x55\x55\x55\xd5\x3f").equals(0.33333333333333333),
  be64: float64.bigendian().reconstruct([0x3f,0xd5,0x55,0x55,0x55,0x55,0x55,0x55]).equals(0.333333333333333333333)
});



var INPUT = ("#abcdefghijklmnopqrstuvwxyz\n"+
             "#ABCDEFGHIJKLMNOPQRSTUVWXYZ\n"+
             "#19191919191919191919191919\n"+
             "#[one][two][three]OK\n"+
             "#>ĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂ<");

function test(type, i) {
  try {
    console.log();
    console.log(i+1, ":", type.toString());
    var tree = type.deconstructString(INPUT, true);
    console.log(require("util").inspect(tree));
  } catch (de) {
    if (de.complain) {
      de.complain();
    } else {
      throw de;
    }
  }
}

function ord(s, bigendian) {
  var result = 0;
  if (bigendian)
    for (var i = 0; i < s.length; ++i)
      result = result * 256 + s.charCodeAt(i);
  else
    for (var i = s.length-1; i >= 0; --i)
      result = result * 256 + s.charCodeAt(i);
  return result;
}


function each(obj, callback) {
  if (Array.isArray(obj))
    for (var i = 0; i < obj.length; ++i) 
      callback(obj[i], i);
  else
    for (var p in obj) 
      if (obj.hasOwnProperty(p)) 
        callback(obj[p], p);
}


each([
  string(3).equals("#ab"),
  char.array(3).equals("#ab"),
  char.array(5).if(true).equals("#abcd"),
  char.array(3).if(function(){return this+"" === "#ab"}).equals("#ab"),
  int8,
  int8.at(1).underlying,
  int8.at(1),
  int8.at(1).littleendian().equals(ord('a')),
  int8.at(1).bigendian().equals(ord('a')),
  int16.at(1).littleendian().equals(ord('ab')),
  int16.at(1).bigendian().equals(ord('ab', true)),
  int32.at(1).littleendian().equals(ord('abcd')),
  int32.at(1).bigendian().equals(ord('abcd', true)),
  string(0).equals(""),
  char.array(0).equals(""),
  byte.array(0).equals([]),
  d.insert('abc').cast(byte.array(3)).equals([97,98,99]),
  d.insert([97,98,99]).cast(string(3)).equals('abc'),
  d.insert('').cast(byte.array(0)).equals([]),
  d.insert([]).cast(string(0)).equals(''),
], test);

each([
  Test1,
  Test2,
  Test3,
  Test4,
  Test5,
  Test6,
  Test7,
  Test8,
  Test9,
  Test10,
  Test11,
  Test12,
  Test13,
  Test14,
  Test15,
  Test16,
  Test17,
  Test18,
  Test19,
  Test20,
  Test21,
  Test22
], test);

console.log("\nOK");
