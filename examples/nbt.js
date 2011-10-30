var d = require("../decon");

var Byte = d.int8;
var Short = d.int16;
var Int = d.int32;
var Long = d.int64;
var Float = d.float32;
var Double = d.float64;

var Byte_Array = d.struct({ 
  length: d.int32,
  value: d.int8.array('length')
}).select('value');

var String = d.struct({ 
  length: d.int16,
  value: d.char.array('length')
}).select('value');

function flatten() {
  var result = {};
  for (var i = 0; i < this.length; ++i) 
    for (var k in this[i])
      if (this[i].hasOwnProperty(k))
        result[k] = this[i][k];
  return result;
}

var Compound = d.ref("TaggedData").array({until: null}).select(flatten);

function iftag(n) { return function (s) { return s.tagId == n; }; }
var List = d.ref("List", d.struct({
  tagId: d.byte,
  length: d.int32,
  value: d.union([
    Byte.if(iftag(1)),
    Short.if(iftag(2)),
    Int.if(iftag(3)),
    Long.if(iftag(4)),
    Float.if(iftag(5)),
    Double.if(iftag(6)),
    Byte_Array.if(iftag(7)),
    String.if(iftag(8)),
    d.ref("List").if(iftag(9)),
    Compound.if(iftag(10))
      ]).array('length')
}));



var TAG = function (n, type) { return d.struct({
  _t: d.byte.equals(n),
  name: String,
  value: type }).select(function (s) { result = {}; 
                                       result[this.name] = this.value;
                                       return result; }); };


var TaggedData = d.ref("TaggedData", d.union([
  d.byte.equals(0).select(null),
  TAG(1, Byte),
  TAG(2, Short),
  TAG(3, Int),
  TAG(4, Long),
  TAG(5, Float),
  TAG(6, Double),
  TAG(7, Byte_Array),
  TAG(8, String),
  TAG(9, List),
  TAG(10, Compound)
]));


var NbtFile = TaggedData.bigendian();

console.log(JSON.stringify(NbtFile.parseFile("../../nbt/map.dat")));
