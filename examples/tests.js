/*
#abcdefghijklmnopqrstuvwxyz
#ABCDEFGHIJKLMNOPQRSTUVWXYZ
#19191919191919191919191919
#[one][two][three]OK
#>ĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂ<
*/

var d = require('../decon');
var struct = d.struct;
var literal = d.literal;
var union = d.union;
var char = d.char;
var byte = d.byte;
var bool = d.bool;
var int8 = d.int8;
var int16 = d.int16;
var int32 = d.int32;
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
  ba: int16.at(1).littleendian().equals(ord('ba')),
  ab: int16.at(1).bigendian().equals(ord('ab')),
  dcba: int32.at(1).littleendian().equals(ord('dcba')),
  abcd: int32.at(1).bigendian().equals(ord('abcd'))
});


var terminator = char.equals('T');
var TString = char.array({through: terminator});
var Test3 = struct({
  _1: char.array({before: 'L'}),
  _2: literal("LMNOP"),
  Q: char,
  totee: TString.equals("RST"),
}).check(function() { return this.Q == "Q" });


var Test4 = struct({
  _: byte.array({before: '1'}),
  little: Little,
  big: Big,
});
var Word = byte.signed().size(16);
var Big = struct({ word: Word }).bigendian();
var Little = struct({ word: Word }).littleendian();

 
var Test5 = struct({
  _1: string({through: "["}),
  one: string({before: ']'}),
  apple: string(2),
  two: string({through: 'o'}),
  closebracket: char,
  _2: "[three]",
  ok: "OK"
});


var String5 = string(5);
var Test6 = struct({
  reprise: String5.at(0),
  thing1: byte,
  thing2: byte.equals(function(){ return this.thing1 + 1;}),
  things: struct({b: byte.equals(function(N){ return thing1 + 2 + N;}).
                  array(2) })
});

/*
var Test7 = struct({
  _1: byte '#'
  _2: uint8 'a'
  uint16 'bc'
  uint32 'defg'
  uint64 'hijklmno'
  sbyte 'p'
  int8 'q'
  int16 'rs'
  char[until '#']
  int32 'ABCD'
  int64 'EFGHIJKL'
  mmmmhmmm: char
});


var Test8 = struct({
  pound: char,
  a: char,
  b: char,
}).select("a").equals("a");


var czech = null.select(true);  // TODO: make official?
var Test9 = union([
  char.check(function(){return 1 == 2;}),
  literal("N"),
  char.if(function () {return 4 = 5}),
  struct ({_: null.check("t" == "t"); should: string(2) }),
  struct ({wontgethere: "#abc"}),
}).equals({"should":"#a"});

# Recursive def'n
var Test10 = union([
  struct({_: "#", pound: Test10 }),
  struct({a: "a"})
});
 
Test11: {
  key1: char
  value1: char
  key2: char
  value2: char
  map1: null.select {key1:value1}
  map2: null.select {key1:value1, key2:value2}
}.select(map2) {"b":"c","#":"a"}


Test12: char.check(this = "#")


Test13: byte[3] (['#', 'a', 'b'])


Test14: { 
  char[through 'z']
  newline: char "\n"
}


Test15: {
  char[through '>']
  ahornc: char
  ahornb: byte
  i16: int16
  u16: uint16
  i32: int32
  u32: uint32
  i64: int64
  u64: uint64
}

<script>
function double(x) {
  return x + x;
}
function triplethis() {
  return this + this + this;
}
</script>

Test16: {
  char
  abcabc: char[3].select(double(this)) "abcabc"
  de3: char[2].select(triplethis()) "dedede"
}


Test17: {
  filename: null.select(filename)
  another: OtherType.deconstruct("ZYXWandetc")
  other: OtherFile.load(filename)
}
OtherType: { 
  threeStrings: char[3][3]
  byte[]
}
OtherFile: { 
  threeStrings: char[3][3]
  filename: null.select(filename)
  byte[] 
}

<script>
function thebits() {
  var r = [];
  for (var i = 7; i >= 0; --i)
    r.push(this >> i & 1);
  return r;
}
function thenibbles() {
  return [this >> 4, this & 0xf];
}
</script>

Test18: {
  bpound: byte.at(0).select(thebits())
  pound: bit[8].at(0) (bpound)
  na: byte.at(1).select(thenibbles())
  a: nibble[2].at(1) (na)
}
bit: size 1 byte
nibble: size 4 byte

Test19: {
  somebits: bit[8][8][2]
  pos: null.select(position) (0x10)
}

Test20: {
  char[10].cast(char[until 'c']) "#ab"
  char[10].cast(char[until 'm']) "jkl"
  hello1: null.select("hello\000\000\000")
  hello: null.select("hello\000\000\000").cast(cstring) "hello"
}


Test21: union {
  char[1].if(false)
  char[2].if(this = "xy")
  char[3].if(this = "#ab")
  char[4]
} "#ab"


Test22: {
  le32: float32.littleendian.deconstruct([0,0,0x80,0x3f]) 1 
  le32a: float32.littleendian.deconstruct("\x00\x00\x80\x3f") 1
  be32: float32.bigendian.deconstruct([0x3f,0x80,0,0]) 1
  le64: float64.littleendian.deconstruct("\x55\x55\x55\x55\x55\x55\xd5\x3f") 0.33333333333333333
  be64: float64.bigendian.deconstruct([0x3f,0xd5,0x55,0x55,0x55,0x55,0x55,0x55]) 0.333333333333333333333
}


Test23: {}
Test24: {}
Test25: {}
Test26: {}
Test27: {}
Test28: {}
Test29: {}

*/

/*
var Main = struct({
  test1: Test1.at(0),
  test2: Test2.at(0),
  test3: Test3.at(0),
  test4: Test4.at(0),
  test5: Test5.at(0),
  test6: Test6.at(0),
*/
/*  test7: Test7.at(0),
  test8: Test8.at(0),
  test9: Test9.at(0),
  test10: Test10.at(0),
  test11: Test11.at(0),
  test12: Test12.at(0),
  test13: Test13.at(0),
  test14: Test14.at(0),
  test15: Test15.at(0),
  test16: Test16.at(0),
  test17: Test17.at(0),
  test18: Test18.at(0),
  test19: Test19.at(0),
  test20: Test20.at(0),
  test21: Test21.at(0),
  test22: Test22.at(0),
  test23: Test23.at(0),
  test24: Test24.at(0),
  test25: Test25.at(0),
  test26: Test26.at(0),
  test27: Test27.at(0),
  test28: Test28.at(0),
  test29: Test29.at(0)*/
//});

var INPUT = ("#abcdefghijklmnopqrstuvwxyz\n"+
             "#ABCDEFGHIJKLMNOPQRSTUVWXYZ\n"+
             "#19191919191919191919191919\n"+
             "#[one][two][three]OK\n"+
             "#>ĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂĂ<");

function test(i,type) {
  try {
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

function ord(s) {
  var result = 0
  for (var i = 0; i < s.length; ++i)
    result = result * 256 + s.charCodeAt(i);
  return result;
}

[Test1,
 int8,
 int8.at(1).underlying,
 int8.at(1),
 int8.at(1).littleendian().equals(ord('a')),
 int8.at(1).bigendian().equals(ord('a')),
 int16.at(1).littleendian().equals(ord('ba')),
 int16.at(1).bigendian().equals(ord('ab')),
 int32.at(1).littleendian().equals(ord('dcba')),
 int32.at(1).bigendian().equals(ord('abcd')),
 Test2,
 Test3, /*
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
 Test20*/
].each(test);