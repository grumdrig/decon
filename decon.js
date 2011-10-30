#!/usr/bin/env node
// TODO: change some parseValue's to parseExpression?
// TODO: get rid of "base"?
// TODO: bigint. see https://github.com/substack/node-bigint
//                or https://github.com/dankogai/js-math-bigint
// TODO: get rid of Type.check, use NULL.select(true).equals(...) if needed?

var fs = require("fs");
var inspect = require("util").inspect;

// Syntax error during deconstruction phase
function DeconError(problem, context) {
  this.problem = problem;
  this.context = context;

  var err = new Error;
  err.name = 'Trace';
  err.message = '';
  Error.captureStackTrace(err, arguments.callee);
  this.stack = err.stack;

  this.complain = function () {
    if (isnull(this.context)) {
      console.error("NO CONTEXT!");
      this.context = { bitten: -1, xxd: function () {} };
    }
    
    // TODO print some more context
    console.error("DECON ERROR (@" + this.context.bitten + "): " +
                  this.problem);
    console.error(this.context.xxd());
    console.error(this.context.stack);
    console.error(this.context.scope);
    console.error(this.stack);
    process.exit(-2);
  };
}


function isnull(x) {
  return (x === null || x === undefined || 
          typeof x === 'undefined' || typeof x === 'null');
}


String.prototype.endsWith = function (suffix) {
  return this.indexOf(suffix, this.length - suffix.length) !== -1;
};
String.prototype.startsWith = function (prefix) {
  return this.substr(0, prefix.length) === prefix;
};


function each(obj, callback) {
  if (Array.isArray(obj))
    for (var i = 0; i < obj.length; ++i) 
      callback(obj[i], i);
  else
    for (var p in obj) 
      if (obj.hasOwnProperty(p)) 
        callback(obj[p], p);
}


function Context(buffer, symbols) {
  this.bitten = 0;
  this.result = null;
  this.modifiers = {};
  this.defaults = {};
  this.scope = [GLOBALS];
  if (symbols) this.scope.push(symbols);
  this.stack = [];
  this.indent = 0;

  this.bite = function () {
    return buffer[this.bitten++];
  }

  this.buffer = buffer;

  this.peek = function () {
    return buffer[this.bitten];
  }
    
  this.eof = function () {
    return this.bitten >= buffer.length && isnull(this.bits);
  }

  this.length = function () {
    return buffer.length;
  }

  this.evaluate = function (v, that, dereference) {
    var scope = {position: this.bitten};
    each(this.scope, function (s) { each(s,function(v,k){scope[k] = v;}); });
    if (dereference && typeof v == typeof '' && !isnull(scope[v]))
      v = scope[v];
    while (typeof v == 'function')
      v = v.call(that, scope);
    return v;
  }

  this.xxd = function () {
    var result = "000000" + this.bitten.toString(16) + ": ";
    result = result.substr(result.length - 9);
    var chars = "";
    for (var i = this.bitten; i < this.bitten + 16 && i < buffer.length; ++i) {
      if (buffer[i] < 16) result += '0';
      result += buffer[i].toString(16);
      if (((i-this.bitten) & 1) == 1) result += ' ';
      chars += (buffer[i] < 32 || buffer[i] >= 128) ? "." : 
        String.fromCharCode(buffer[i]);
    }
    return result + " " + chars;
  };

}



function Type() {

  this.deconstructFile = function (filename, partialok) {
    var inbuf = fs.readFileSync(filename);
    var context = new Context(inbuf, {filename:filename});
    var result = this.deconstruct(context);
    if (isnull(partialok)) partialok = context.adjusted;
    if (!partialok && !context.eof())
      throw new DeconError("Unconsumed data [" + (context.length() - context.bitten) + "] at end of file " + filename, context);
    return result;
  };
  
  this.deconstructString = function (string, partialok) {
    var inbuf = new Buffer(string);
    var context = new Context(inbuf);
    var result = this.deconstruct(context);
    if (isnull(partialok)) partialok = context.adjusted;
    if (!partialok && !context.eof())
      throw new DeconError("Unconsumed data [" + (context.length() - context.bitten) + "] at end of file", context);
    return result;
  };
  
  this.parseFile = function (filename, partialok) {
    try {
      return this.deconstructFile(filename, partialok);
    } catch (de) {
      if (de.complain) de.complain(); else throw de;
    }
  };

  this.parse = function (string, partialok) {
    try {
      return this.deconstructString(string, partialok);
    } catch (de) {
      if (de.complain) de.complain(); else throw de;
    }
  };

  this.isAscii = function (context) { return false; };

  this.dereference = function (context) { return this; };

  // Construction

  this.array = function (limit) {
    return new ArrayType(this, limit);
  };

  this.at = function (position) {
    return new AtType(this, position);
  };

  this.reconstruct = function (data) {
    return new ReconstructionType(this, data);
  };
  
  this.load = function (filename) {
    return new LoadType(this, filename);
  };

  this.if = function (replacement) {
    return new IfType(this, replacement);
  };

  this.select = function (replacement) {
    return new SelectType(this, replacement);
  };

  this.equals = function (value) {
    return new EqualsType(this, value);
  };

  this.check = function (test) {
    return new TestedType(this, test);
  };

  this.cast = function (newtype) {
    return new CastType(this, newtype);
  };

  this.size = function (size) {
    return new ModifiedType("size", size, this);
  };

  this.signed = function () { 
    return new ModifiedType("signed", true, this);  };
  this.unsigned = function () { 
    return new ModifiedType("signed", false, this); };

  this.bigendian = function () { 
    return new ModifiedType("bigendian", true, this); };
  this.littleendian = function () { 
    return new ModifiedType("bigendian", false, this); };
}


ReferenceType.prototype = new Type();
ArrayType.prototype = new Type();
NullType.prototype = new Type();
AtomicType.prototype = new Type();
ModifiedType.prototype = new Type();
AtType.prototype = new Type();
ReconstructionType.prototype = new Type();
LoadType.prototype = new Type();
IfType.prototype = new Type();
SelectType.prototype = new Type();
CastType.prototype = new Type();
StructType.prototype = new Type();
EqualsType.prototype = new Type();
TestedType.prototype = new Type();
InsertionType.prototype = new Type();


function ReferenceType(name) {
  this.name = name;
  
  this.dereference = function (context) {
    var result = TYPES[name];
    if (isnull(result)) throw new DeconError("Undefined type " + name, context);
    result = result.dereference(context);
    return result;
  };

  this.toString = function (context) {
    if (!isnull(context) && context.stack.indexOf(name) >= 0) {
      return name;
    } else {
      if (isnull(context)) context = new Context();
      context.stack.unshift(name);
      var result = name + ":" + this.dereference(context).toString(context);
      context.stack.shift();
      return result;
    }
  };

  this.deconstruct = function(context) {
    var t = TYPES[name];
    context.stack.unshift(name);
    if (isnull(t))
      throw new DeconError("Undefined type " + name, context);
    var result = t.deconstruct(context);
    context.stack.shift();
    return result;
  };

  this.isAscii = function (context) {
    var t = this.dereference(context);
    return isnull(t) ? false : t.isAscii(context);
  };   
}



function ArrayType(element, limit) {

  if (isnull(limit))
    limit = {};
  else if (typeof limit == typeof 1)  
    limit = {length: limit};
  else if (typeof limit == typeof '')
    limit = {length: limit};

  this.toString = function (context) {
    return '' + element.toString(context) + "[...]";
  };

  function equals(terminator, value, context) {
    if (isnull(terminator)) return false;
    var term = context.evaluate(terminator);
    if (typeof term != typeof value) {
      if (typeof term == typeof 1)  term = String.fromCharCode(term);
      if (typeof value == typeof 1) value = String.fromCharCode(value);
    }
    return value === term;
  }

  this.deconstruct = function (context) {
    context.result = null;
    if (limit.index)
      context.scope.unshift({});
    var isstr = element.isAscii(context);
    var result = isstr ? "" : [];
    for (var i = 0; ; ++i) {
      if (limit.index)
        context.scope[0][limit.index] = i;
      if (!isnull(limit.length)) {
        var count = context.evaluate(limit.length, context.result, true);
        if (typeof count != typeof 1)
          throw new DeconError("Invalid array length: " + 
                               inspect(count), context);
        if (i >= count) break;
        if (context.eof()) 
          throw new DeconError("EOF deconstructing array after " + i + " of " +
                               count + " elements", context);
      }
      if (context.eof())
        break;
      if (equals(limit.before, context.peek(), context)) break;
      var v = element.deconstruct(context);
      if (equals(limit.until, context.result, context)) break;
      if (isstr)
        result += v;
      else
        result.push(v);
      if (equals(limit.through, context.result, context)) break;
    }
    context.result = result;
    if (limit.index)
      context.scope.shift();
    return context.result;
  }
}


function NullType() {
  this.toString = function (context) { return 'Ø'; }
  this.deconstruct = function (context) { return context.result = null; }
}
 

function AtomicType(basis) {
  function attr(context, key, defvalue) {
    if (!isnull(basis[key])) return basis[key];
    if (!isnull(context)) {
      var result = context.modifiers[key];
      if (isnull(result)) 
        result = context.defaults[key];
      if (!isnull(result)) {
        if (typeof result == 'function')
          result = result();
        return result;
      }
    }
    return defvalue;
  }

  function signed(context)    {  return attr(context, "signed",    false);  }
  function size(context)      {  return attr(context, "size",      8);  }
  function bigendian(context) {  return attr(context, "bigendian", false);  }
  function base(context)      {  return attr(context, "base",      10);  }

  this.isAscii = function (context) {
    return base(context) == 256;
  };

  this.toString = function (context) {
    var result = (signed(context) ? "i" : "u") + size(context);
    if (bigendian(context)) result = result.toUpperCase();
    switch (base(context)) {
    case 0.5: result += "f";  break;
    case 2:   result += "b";  break;
    case 256: result += "c";  break;
    }
    return result;
  };

  function negateByte(v) {
    // two's complement
    return (0xff - v + 1) * -1;
  }

  this.deconstruct = function (context) {
    var siz = size(context);

    if (base(context) == 0.5) {
      // Float
      var mantissa;
      switch (siz) {
      case 16:  mantissa = 10;  break;
      case 32:  mantissa = 23;  break;
      case 64:  mantissa = 52;  break;
      case 128: mantissa = 112; break;
      default:
        throw new DeconError("Unsupported floating point size: " + siz, context);
      }
      context.result = readIEEE754(context.buffer, context.bitten, 
                                   bigendian(context), mantissa, siz / 8);
      context.bitten += siz / 8;
      return context.result;
    }

    if (siz > 8 && siz & 0x7) 
      throw new DeconError("Size " + siz + " data not implemented", context);
    context.result = 0;
    for (var i = 0; siz > 0; i += 8) {
      if (!isnull(context.bits) || siz < 8) {
        var v = 0;
        while (siz > 0) {
          if (!context.bits) context.bits = {bits: context.bite(), length: 8};
          var mask = 1 << (context.bits.length-1);
          v = (v << 1) | ((context.bits.bits >> (context.bits.length-1)) & 1);
          if (--context.bits.length === 0)
            context.bits = null;
          --siz;
        }
        context.result = v;
      } else {
        var v = context.bite();
        siz -= 8;
        if (bigendian(context)) {
          if (signed(context) && i === 0 && (v & 0x80)) 
            v = negateByte(v);
          context.result <<= 8;
          context.result += v;
        } else {
          if (signed(context) && i === size(context) - 8 && (v & 0x80)) 
            v = negateByte(v);
          context.result |= v << i;
        }
      }
    }
    if (base(context) === 256) 
      context.result = String.fromCharCode(context.result);
    else if (base(context) === 2) 
      context.result = !!context.result;
    return context.result;
  };
}



// Borrowed from
// https://github.com/joyent/node/blob/master/lib/buffer_ieee754.js
function readIEEE754(buffer, offset, isBE, mLen, nBytes) {
  var e, m,
  eLen = nBytes * 8 - mLen - 1,
  eMax = (1 << eLen) - 1,
  eBias = eMax >> 1,
  nBits = -7,
  i = isBE ? 0 : (nBytes - 1),
  d = isBE ? 1 : -1,
  s = buffer[offset + i];

  i += d;

  e = s & ((1 << (-nBits)) - 1);
  s >>= (-nBits);
  nBits += eLen;
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8);

  m = e & ((1 << (-nBits)) - 1);
  e >>= (-nBits);
  nBits += mLen;
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8);

  if (e === 0) {
    e = 1 - eBias;
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity);
  } else {
    m = m + Math.pow(2, mLen);
    e = e - eBias;
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
};


function equal(a, b) {
  if (a === b) return true;
  
  if (typeof a !== typeof b) return false;
  
  if (typeof a !== 'object') return false;
  
  for (var i in a) {
    if (a.hasOwnProperty(i)) {
      if (!b.hasOwnProperty(i)) return false;
      if (!equal(a[i], b[i])) return false;
    }
  }
  for (var i in b) 
    if (b.hasOwnProperty(i) && !a.hasOwnProperty(i)) return false;
  
  return true;
}


function ModifiedType(key, value, underlying) {
  this.key = key;
  this.value = value;
  this.underlying = underlying;

  this.isAscii = function (context) {
    // Base doesn't get modified
    return this.underlying.isAscii(context);
  }


  this.toString = function (context) {
    if (["at"].indexOf(this.key) >= 0) {
      return this.underlying.toString(context) + "." + this.key + "(" + 
             this.value.toString() + ")";
    }
      
    if (isnull(context)) context = new Context();

    if (!isnull(context.modifiers[this.key])) {
      return this.underlying.toString(context);
    } else {
      var formervalue = context.modifiers[this.key];
      context.modifiers[this.key] = this.value;
      
      var result = this.underlying.toString(context);
      
      context.modifiers[this.key] = formervalue;
      return result;
    }
  }

  this.deconstruct = function (context) {
    if (!isnull(context.modifiers[this.key])) {
      return this.underlying.deconstruct(context);
    } else {
      var formervalue = context.modifiers[this.key];
      context.modifiers[this.key] = this.value;
      
      var result = this.underlying.deconstruct(context);
      
      context.modifiers[this.key] = formervalue;

      return result;
    }
  }
}


function AtType(underlying, position) {

  this.toString = function (context) {
    return underlying.toString(context) + ".at(" + position + ")";
  }

  this.isAscii = function (context) { return underlying.isAscii(context); }

  this.deconstruct = function (context) {
    context.bitten = context.evaluate(position);
    context.adjusted = true;
    return underlying.deconstruct(context);
  }
}


function ReconstructionType(underlying, data) {
  // TODO: no one even asked for this feature
  // a.reconstruct(b) can be replaced by insert(b).cast(a)

  this.toString = function (context) {
    return underlying.toString(context) + ".reconstruct(" + data + ")";
  }

  this.isAscii = function (context) { return underlying.isAscii(context); }

  this.deconstruct = function (context) {
    var c2 = new Context(new Buffer(context.evaluate(data), 'binary'));
    return underlying.deconstruct(c2);
  }
}

function LoadType(underlying, filename) {
  // TODO: don't know about this feature. Kind of breaks the model.
  // Plus, a.load(b) can be repl by insert(fs.readfileorsomething(b)).cast(a)

  this.toString = function (context) {
    return underlying.toString(context) + ".load(" + filename + ")";
  }

  this.isAscii = function (context) { return underlying.isAscii(context); }

  this.deconstruct = function (context) {
    var fname = context.evaluate(filename);
    return underlying.deconstructFile(fname);
  }
}


function IfType(underlying, test) {

  this.toString = function (context) {
    return underlying.toString(context) + ".if(" + 
                                               test.toString(context) + ")";
  }

  this.isAscii = function (context) { return underlying.isAscii(context); }

  this.deconstruct = function (context) {
    var wasbit = context.bitten;
    var result = underlying.deconstruct(context);
    var check = context.evaluate(test, result);
    if (check) {
      return result;
    } else {
      context.bitten = wasbit;
      return;
    }
  }      
}


function SelectType(underlying, replacement) {

  this.toString = function (context) {
    return underlying.toString(context) + ".select(" + 
                              replacement.toString(context) + ")";
  }

  this.isAscii = function (context) {
    return typeof replacement == typeof '';
  }

  this.deconstruct = function (context) {
    var result = underlying.deconstruct(context);
    if (typeof replacement == typeof '' && !isnull(result[replacement]))
      return result[replacement];
    return context.evaluate(replacement, result);
  }
}

function CastType(underlying, replacement) {

  this.toString = function (context) {
    return underlying.toString(context) + ".cast(" + 
                              replacement.toString(context) + ")";
  }

  this.isAscii = function (context) {
    return replacement.isAscii(context);
  }

  this.deconstruct = function (context) {
    var c2 = new Context(new Buffer(underlying.deconstruct(context)));
    return context.evaluate(replacement).deconstruct(c2);
  }
}


function StructType(union) {

  function Field(name, type) {
    this.name = name;
    this.type = type;

    this.toString = function (context) {
      return type.toString(context) + (isnull(name) ? "" : (" " + name));
    }
  }
  
  var fields = [];

  this.addField = function (name, type) {
    fields.push(new Field(name, type));
  }

  function pushScope(context) {
    var state = [context.defaults, context.modifiers];
    for (var k in context.modifiers) 
      if (context.modifiers.hasOwnProperty(k))
        context.defaults[k] = context.modifiers[k];
    context.modifiers = {};
    context.scope.unshift({});
    context.indent++;
    return state;
  }

  function popScope(context, state) {
    context.defaults = state[0];
    context.modifiers = state[1];
    context.scope.shift();
    context.indent--;
  }

  this.toString = function (context) {
    if (isnull(context)) context = new Context();
    var formerstate = pushScope(context);
    var result = "{\n";
    if (union) result = "union " + result;
    for (var i = 0; i < fields.length; ++i) 
      result +=  new Array(context.indent + 1).join("  ") +
        fields[i].toString(context) + "\n";
    popScope(context, formerstate);
    return result + new Array(context.indent + 1).join("  ")  + "}";
  }

  this.deconstruct = function (context) {
    var formerstate = pushScope(context);
    var result = context.scope[0];
    var wasbitten = context.bitten;
    for (var i = 0; i < fields.length; ++i) {
      try {
        var unbitten = context.bitten;
        var field = fields[i];
        context.stack.unshift(field.name);
        var value = field.type.deconstruct(context);
        context.stack.shift();
        if (union && (typeof value != 'undefined')) {
          result = value;
          break;
        }
        if (!isnull(field.name) && !field.name.startsWith("_"))
          result[field.name] = value;
      } catch (e) {
        if (!(e instanceof DeconError)) throw e;
        if (!union) throw e;
        context.bitten = wasbitten;
      }
    }
    if (union && i >= fields.length) 
      throw new DeconError("No input matching union", context);
    popScope(context, formerstate);
    return (context.result = result);
  }
}


function EqualsType(underlying, value) {

  this.toString = function (context) {
    return underlying.toString(context) + ".equals(" + value + ")";
  };

  this.deconstruct = function (context) {
    var result = underlying.deconstruct(context);
    if (!equal(context.evaluate(value, result), result)){
      throw new DeconError("Non-matching value. Expected: " + 
                           inspect(context.evaluate(value, result)) + 
                           ", got:" +  inspect(result), context);
    }
    return result;
  }
}


function TestedType(underlying, test) {

  this.toString = function (context) {
    return underlying.toString(context) + ".check(" + test + ")";
  };

  this.deconstruct = function (context) {
    var result = underlying.deconstruct(context);
    var check = context.evaluate(test, result);
    if (!check)
      throw new DeconError("Failed check for: " + inspect(result) +
                           ": " + test, context);
    return result;
  };
}


function typeForValue(v) {
  if (isnull(v))
    return new ReferenceType("null");
  else if (typeof v == typeof true)
    return new ReferenceType("bool");
  else if (typeof v == typeof 1) {
    if (-0x80 <= v && v < 0x80)
      return new ReferenceType("int8");
    else if (-0x8000 <= v && v < 0x8000)
      return new ReferenceType("int16");
    else if (-0x80000000 <= v && v < 0x80000000)
      return new ReferenceType("int32");
    else
      return new ReferenceType("int64");
  } else if (Array.isArray(v)) {
    if (v.length == 0)
      return new ReferenceType("null").array(0);
    else 
      return typeForValue(v[0]).array(v.length);
  } else if (typeof v == typeof "") {
    return new ReferenceType("char").array(v.length);
  } else if (typeof v == typeof {}) {
    var result = new StructType();
    each(v, function (v,k) { result.addField(k, typeForValue(v)); });
    return result;
  } else {
    throw new DeconError("can't determine type from value");
  }
}


function modref(attr, val, ref) {
  return new ModifiedType(attr, val, new ReferenceType(ref));
}

var TYPES = {
  null: new NullType(),
  bool: new AtomicType({base: 2}),
  char: new AtomicType({base: 256}),
  byte: new AtomicType({}),

  uint8:  modref("size",  8, "byte"),
  uint16: modref("size", 16, "byte"),
  uint32: modref("size", 32, "byte"),
  uint64: modref("size", 64, "byte"),

  sbyte: modref("signed", true, "byte"),
  int8:  modref("size",  8, "sbyte"),
  int16: modref("size", 16, "sbyte"),
  int32: modref("size", 32, "sbyte"),
  int64: modref("size", 64, "sbyte"),

  float: new AtomicType({base: 0.5}),
  float32: modref("size", 32, "float"),
  float64: modref("size", 64, "float"),

  cstring: new ReferenceType("char").array({until: '\0'})
}


var GLOBALS = {
};


exports.struct = function (fields) {
  var result = new StructType(false);
  for (var name in fields) if (fields.hasOwnProperty(name)) {
      var type = fields[name];
      if (!(type instanceof Type))
        type = exports.literal(type);
      result.addField(name, type);
    }
  return result;
};

exports.union = function (fields) {
  var result = new StructType(true);
  each(fields, function (type) {
      if (!(type instanceof Type))
        type = exports.literal(type);
      result.addField(null, type);
    });
  return result;
};

exports.literal = function (value) {
  return new EqualsType(typeForValue(value), value);
};

exports.load = function (filename, type) {
  return new LoadType(type, filename);
};

exports.string = function (limit) {
  return new ArrayType(new ReferenceType("char"), limit);
};

//TODO: should we trash this concept?
exports.ref = function (name, type) {
  if (isnull(type))
    return new ReferenceType(name);
  else
    return TYPES[name] = type;  // or return referencetype?
};


function InsertionType(value) {
  this.deconstruct = function (context) {
    return context.evaluate(value);
  }
};
  

// TODO: name overloaded - confusing
exports.insert = function (value) {
  return new InsertionType(value);
};

for (var t in TYPES) if (TYPES.hasOwnProperty(t)) exports[t] = TYPES[t];

