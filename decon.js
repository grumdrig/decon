
// TODO: literals
// TODO: get rid of case-significance for types vs fields, etc
// TODO: constants
// TODO: probably want a string type
// TODO: use a context for dereferencing
// TODO: back-references and indices on arrays

var fs = require("fs");

// Syntax error during .con file parsing
function ParseError(problem) {
  this.problem = problem;

  var err = new Error;
  err.name = 'Trace';
  err.message = '';
  Error.captureStackTrace(err, arguments.callee);
  this.stack = err.stack;
}

// Syntax error during deconstruction phase
function DeconError(problem, context) {
  this.problem = problem;
  this.context = context;

  var err = new Error;
  err.name = 'Trace';
  err.message = '';
  Error.captureStackTrace(err, arguments.callee);
  this.stack = err.stack;
}


// From http://java.sun.com/javase/6/docs/api/java/lang/Double.html
var D = "(?:\\p{Digit}+)";
var H = "(?:\\p{XDigit}+)";
var E = "[eE][+-]?" + D;
var fpRegex =
  ("[+-]?(?:" +                                      // sign
   "NaN|" +                                          // NaN
   "Infinity|" +                                     // Infinity
   "(?:(?:(?:"+D+"(?:\\.)?(?:"+D+"?)(?:"+E+")?)|"+   // 9.9e+9 etc
   "(?:\\.(?:"+D+")(?:"+E+")?)|"+                    // .9e+9 etc
   "(?:(?:" +                                
   "(?:0[xX]"+H+"(?:\\.)?)|" +                     // 0xF.
   "(?:0[xX]"+H+"?(?:\\.)"+H+")" +                 // 0xF.F
   ")[pP][+-]?"+D+"))" +                             // ... p+F
   "[fFdD]?))");                                     // suffix

var intRegex = "[+-]?[0-9]+";
//var punctRegex = "[-!#$%&()\\*\\+,\\./:;<=>?@\\[\\\\]^_`{|}~]";
var punctRegex = "[-\\.*/+={}\\[\\]():]";
                

function TokenMatcher(input) {
  this.input = input;
  
  this.re = new RegExp("^"                         //    beginning at last match:
                       +"([ \t]*(?:#.*)?)"         // 1. spaces & comments before
                       +"("                        // 2. any token: (
                       +  "([\\r\\n])"             // 3.   \n
                       +  "|\"(.*)\""              // 4.   quoted
                       +  "|'(.*)'"                // 5.   single-quoted
                       +  "|([_a-z]\\w*)"          // 6.   lcid
                       +  "|([A-Z]\\w*)"           // 7.   ucid
                       +  "|0[xX]([0-9a-fA-F]+)"   // 8.   hex constant
                       +  "|("+intRegex+")"        // 9.   numerical constant
                       +  "|("+punctRegex+")"      // 10.  punctuation
                       +  "|($)"                   // 11.  EOF
                       +  "|(.)"                   // 12.  illegal
                       +")");                      //    ) 

  this.find = function () {
    this.match = this.re.exec(this.input.substr(this.pos));
    if (this.match) {
      this.pos += this.match[0].length;
    }
    return this.match;
  }
  
  this.groupCount = function () { return this.match.length; }

  this.group = function (n) { return this.match && this.match[n || 0]; }
  
  this.lookingAt = function () { 
    return this.find();//re.test(this.input.substr(this.pos));
  }

  this.pos = 0;
}

// Token types
var T = {
  WHITESPACE   : 1,
  TOKEN        : 2,
  NEWLINE      : 3,
  QUOTED       : 4,
  SINGLEQUOTED : 5,
  LCID         : 6,
  UCID         : 7,
  HEXNUMBER    : 8,
  NUMBER       : 9,
  PUNCTUATION  : 10,
  EOF          : 11,
  ILLEGAL      : 12
};

// Reverse-lookup of token types
for (var i in T)
  if (T.hasOwnProperty(i)) 
    T[T[i]] = i;


function isnull(x) {
  return (x === null || x === undefined || 
          typeof x === 'undefined' || typeof x === 'null');
}

function testMatch(input, expected) {
  var m = new TokenMatcher(input);
  for (var i = 0; i < expected.length; ++i) {
    if (!m.find()) {
      console.error("Can't match '" + input + "'");
      process.exit(-3);
    }
    if (isnull(m.group(expected[i]))) {
      for (var g = 0; g <= m.groupCount(); ++g)
        console.error("" + g + ": '" + m.group(g) + "'");
      console.error("Matching " + input + " to token type " + 
                    T[expected[i]]);
      console.error("Unexpected token '" + m.group() + "'");
      process.exit(-3);
    }
  }
}

function testParseNumeric(input, expected) {
  try {
    var p = new DeconParser(input);
    var d = p.parseNumeric();
  } catch (e) {
    if (e instanceof ParseError)
      console.error("Numeric test parse error ["+e.problem+"] '" + input + "'");
    else
      throw e;
    process.exit(-7);
  }
  if (!p.is(T.EOF)) {
    console.error("Numeric test parse dangling stuff for '" + input + "'");
    process.exit(-8);
  }
  if (Math.abs(d - expected) > 0.0001) {
    console.error("Unexpected numeric " + d + " expected " + expected + " for '" + input + "'");
    process.exit(-9);
  }
}

var assert = require("assert").ok;

function runTests() {
  assert(isnull(runTests['nothing']));
  assert(!isnull(runTests));
  assert(isnull(null));
  assert(isnull(undefined));

  testMatch("lcid", [ T.LCID ]);
  testMatch("UcId", [ T.UCID ]);
  testMatch("6", [ T.NUMBER ]);
  testMatch(".", [ T.PUNCTUATION ]);
  testMatch("\"la la la\"", [ T.QUOTED ]);
  testMatch("\n", [ T.NEWLINE ]);
  testMatch("0x0", [ T.HEXNUMBER ]);
  testMatch("0XABC", [ T.HEXNUMBER ]);
  testMatch("*", [ T.PUNCTUATION ]);
  testMatch("=", [ T.PUNCTUATION ]);
  testMatch("* =", [ T.PUNCTUATION, T.PUNCTUATION ]);
  testMatch(" { } ", [ T.PUNCTUATION, T.PUNCTUATION ]);
  testMatch(" <> ", [ T.ILLEGAL, T.ILLEGAL ]);
  
  testParseNumeric("6", 6);
  testParseNumeric("3", 3);
  testParseNumeric("2*3", 2*3);
  testParseNumeric("3*2", 3*2);
  testParseNumeric("-2*3/26", -2*3/26);
  testParseNumeric("0x20", 32);
  testParseNumeric("' '", 32);
  
  console.error("PASS");
}


// TODO: get this into some scope somewhere, not global, please!
var TYPES = {};
var Byte = new NumericType({});
var Char = new NumericType({base: 256});
var Bool = new NumericType({base: 2});
var Null = new NumericType({base: 0, size: 0});
TYPES["Byte"] = Byte;
TYPES["Char"] = Char;
TYPES["Bool"] = Bool;
TYPES["Null"] = Null;

  
function DeconParser(text) {

  var tokenMatcher = new TokenMatcher(text);
  if (!tokenMatcher.lookingAt()) 
    throw new ParseError("Syntax error at start of file");

  function advance() {
    if (!tokenMatcher.find()) {
      throw new ParseError("Unrecognised input");
    }
  }

  this.lineno = function () {
    return tokenMatcher.input.substring(0, tokenMatcher.pos).
      split("\n").length - 1;
  };

  this.errorContext = function () {
    if (!tokenMatcher.match) return "illegal input";
    var t = 3;
    for (; !isnull(T[t]); ++t) {
      if (!isnull(tokenMatcher.group(t))) {
        t = T[t];
        break;
      }
    }
    return t + ": '" + tokenMatcher.group(T.TOKEN) + "'";
  }

  var is = this.is = function (tokenTypeOrLiteral) { 
    if (typeof tokenTypeOrLiteral === typeof "")
      return tokenMatcher.group(T.TOKEN) === tokenTypeOrLiteral;
    else
      return tokenMatcher.group(tokenTypeOrLiteral) != null;
  }

  function take(something) {
    if (isnull(something)) {
      var result = tokenMatcher.group(T.TOKEN);
      advance();
      return result;
    } else if (typeof something === typeof "") {
      var literal = something;
      if (!is(literal))
        throw new ParseError("Expected literal '" + literal + "'");
      return take();
    } else {
      var tokenType = something;
      var result = tokenMatcher.group(tokenType);
      if (isnull(result)) {
        throw new ParseError("Expected " + T[tokenType]);
      }
      advance();
      return result;
    }
  }


  function tryToTake(literal) {
    if (!is(literal)) {
      return false;
    } else {
      advance();
      return true;
    }
  }


  function takeNewlines() {
    take(T.NEWLINE); 
    maybeTakeNewlines();
  }

  function maybeTakeNewlines() {
    while (is(T.NEWLINE)) advance();
  }

  this.go = function () {
    maybeTakeNewlines();
    while (!is(T.EOF)) {
      
      if (tryToTake("import")) {
        // import
        var filename = take(T.QUOTED);
        parseFile(filename);
      } else {
        // Type def
        var name = take(T.UCID);
        take(":");
        var type = parseType();
        TYPES[name] = type;
      }
      
      if (!is(T.EOF)) takeNewlines();
    }
  }

  function parseType() {
    var type = tryToParseType();
    if (isnull(type)) throw new ParseError("Type expected");
    return type;
  }

  function tryToParseType() {
    if (tryToTake("unsigned")) {
      return new ModifiedType("signed", false, parseType());
    } else if (tryToTake("signed")) {
      return new ModifiedType("signed", true, parseType());
    } else if (tryToTake("size")) {
      return new ModifiedType("size", parseNumeric(), parseType());
    } else if (tryToTake("bigendian")) {
      return new ModifiedType("bigendian", true, parseType());
    } else if (tryToTake("littleendian")) {
      return new ModifiedType("bigendian", false, parseType());
    } 

    if (tryToTake("{")) {
      // Struct
      var s = new StructType();
      for (maybeTakeNewlines(); !tryToTake("}"); ) {
        var fieldname = (is(T.LCID)) ? take(T.LCID) : null;
        var fieldvalue = tryToParseLiteral();
        var fieldtype = tryToParseType();
        if (isnull(fieldname) && isnull(fieldvalue) && isnull(fieldtype))
          throw new SyntaxError("Expected field specification");
        s.addField(fieldname, fieldvalue, fieldtype);
        maybeTakeNewlines();
      }
      var result = s;
    } else if (is(T.UCID)) {
      // Reference named type
      var result = new ReferenceType(take(T.UCID));
    } else {
      return;
    }

    while (tryToTake(".")) {
      if (tryToTake("unsigned")) {
        result = new ModifiedType("signed", false, result);
      } else if (tryToTake("signed")) {
        result = new ModifiedType("signed", true, result);
      } else if (tryToTake("size")) {
        result = new ModifiedType("size", parseNumeric(), result);
      } else if (tryToTake("bigendian")) {
        result = new ModifiedType("bigendian", true, result);
      } else if (tryToTake("littleendian")) {
        result = new ModifiedType("bigendian", false, result);
      } else {
        throw new ParseError("Invalid type modifier");
      }
    }
        
    while (tryToTake("[")) {
      result = new ArrayType(result);
      if (tryToTake("until")) {
        result.until = parseLiteral();
      } else if (tryToTake("through")) {
        result.through = parseLiteral();
      } else if (tryToTake("before")) {
        result.before = parseLiteral();
      } else {
        result.length = tryToParseNumeric();
      }
      take("]");
    }
    return result;
  }
                             

  var parseNumeric = this.parseNumeric = function () {
    var r = tryToParseNumeric();
    if (isnull(r))
      throw new ParseError("Numeric value expected");
    return r;
  }

  function tryToParseNumeric() {
    var result;
    if (is(T.NUMBER)) {
      result = parseInt(take());
    } else if (is(T.HEXNUMBER)) {
      result = parseInt(take(T.HEXNUMBER), 16);
    } else if (is(T.SINGLEQUOTED)) {
      // TODO: deal with endianness and type-specifying and all that
      var s = take(T.SINGLEQUOTED);
      result = 0;
      for (var i = 0; i < s.length; ++i) {
        result = (result << 8) + (0xFF & s.charCodeAt(i));
      }
    } else if (tryToTake("(")) {
      result = parseNumeric();
      take(")");
    } else {
      return null;
    }
    
    // TODO: rewrite left-associatively
    if (tryToTake("/")) {
      result /= parseNumeric();
    } else if (tryToTake("*")) {
      result *= parseNumeric();
    } else if (tryToTake("+")) {
      result += parseNumeric();
    } else if (tryToTake("-")) {
      result -= parseNumeric();
    }

    return result;
  }

  function parseLiteral() {
    var literal = tryToParseLiteral();
    if (isnull(literal)) throw new SyntaxError("Literal value expected");
    return literal;
  }

  function tryToParseLiteral() {
    if (is(T.QUOTED)) {
      return JSON.parse('"' + take(T.QUOTED) + '"');
    } else {
      return tryToParseNumeric();
    }
  }
      
}


String.prototype.endsWith = function(suffix) {
  return this.indexOf(suffix, this.length - suffix.length) !== -1;
};


function main() {
  var args = process.argv.slice(2);
  var Main;
  var a = 0;
  for (; a < args.length; ++a) {
    var arg = args[a];
    if (arg.endsWith(".con")) {
      parseFile(arg);
    } else {
      // Must be a type
      Main = TYPES[arg];
      if (isnull(Main)) {
        // Don't know it - look for a .con file
        if (fs.statSync(arg + ".con").isFile())
          parseFile(arg + ".con");
        Main = TYPES[arg];
      }
      if (isnull(Main)) {
        console.error("Construction not found: " + arg);
        process.exit(404);
      }
      ++a;
      break;
    }
  }
  
  if (isnull(Main)) usage();

  try {
    console.error("TYPES:");
    for (var k in TYPES)
      if (TYPES.hasOwnProperty(k))
        console.error(k + ": " + TYPES[k]);

    console.error("MAIN:");
    console.error("" + Main);

    var tree = Main.deconstructFile(args[a++] || '/dev/stdin');
  } catch (de) {
    if (de instanceof DeconError) {
      // TODO print some more context
      console.error("DECONSTRUCTION ERROR @ " + de.context.bitten + ": " +
                    de.problem);
      console.error(de.stack);
      process.exit(-2);
    } else {
      throw de;
    }
  }

  if (a < args.length)
    fs.writeFile(args[a++], JSON.stringify(tree));
  else
    console.log(tree);
}


function usage() {
  console.error("Usage: node decon.js [DEF.con...] MAIN [IN [OUT]]");
  process.exit(302);
}


function readFile(filename) {
  try {
    return fs.readFileSync(filename, 'utf8');
  } catch (IOException) {
    console.error("Error reading file: '" + filename + "'");
    process.exit(1);
    return null;
  }
}

var parseFile = exports.import = function (filename) {
  var program = readFile(filename);
  assert(program);
  try {
    var p = new DeconParser(program);
    p.go();
  } catch (e) {
    if (e instanceof ParseError) {
      // TODO add context
      console.error("SYNTAX ERROR [" + filename + ":" + 
                    (p ? p.lineno() : 0) + "]: " + 
                    e.problem + (p ? " at "+p.errorContext() : ""));
      console.error(e.stack);
      process.exit(-1);
    }
    throw e;
  }
}

  
var parse = exports.parse = function (string) {
  try {
    var p = new DeconParser(string);
    p.go();
  } catch (e) {
    if (e instanceof ParseError) {
      // TODO add context
      console.error("SYNTAX ERROR [" + (p ? p.lineno() : 0) + "]: " + 
                    e.problem + (p ? " at "+p.errorContext() : ""));
      console.error(e.stack);
      process.exit(-1);
    }
    throw e;
  }
  return TYPES;
}


function Context(buffer) {
  this.bitten = 0;
  this.value = null;
  this.modifiers = {};
  this.defaults = {};

  this.bite = function () {
    return buffer[this.bitten++];
  }

  this.peek = function () {
    return buffer[this.bitten];
  }
    
  this.eof = function () {
    return this.bitten >= buffer.length;
  }

  this.length = function () {
    return buffer.length;
  }
}



function Type() {
  this.dereference = function (context) { return this; }

  this.deconstructFile = function (filename) {
    var inbuf = fs.readFileSync(filename);
    var context = new Context(inbuf);
    var result = this.deconstruct(context);
    if (!context.eof())
      throw new DeconError("Unconsumed data at end of file", context);
    return result;
  }

  this.isAscii = function (context) { return false; }
}

Type.sire = function (Child) {
  //Child.prototype = new Type();
  //Child.prototype.constructor = Child;
  var t = new Type();
  for (var k in t)
    if (t.hasOwnProperty(k))
      Child.prototype[k] = t[k];
}

Type.sire(ReferenceType);
Type.sire(ArrayType);
Type.sire(NumericType);
Type.sire(ModifiedType);
Type.sire(StructType);



function ReferenceType(name) {

  this.name = name;
  
  this.dereference = function (context) {
    var result = TYPES[name];
    if (isnull(result)) throw new DeconError("Undefined type " + name, context);
    result = result.dereference(context);
    return result;
  }

  this.toString = function (context) {
    return this.dereference(context).toString(context);
  }

  this.deconstruct = function(context) {
    var t = TYPES[name];
    if (isnull(t))
      throw new DeconError("Undefined type " + name, context);
    return t.deconstruct(context);
  }

  this.isAscii = function (context) {
    var t = this.dereference(context);
    return isnull(t) ? false : t.isAscii(context);
  }    
}



function ArrayType(element) {

  this.element = element;

  this.toString = function (context) {
    var inspect = require("util").inspect;
    return ("" + this.element.toString(context) + "[" + 
            (!isnull(this.until) ? "until " + inspect(this.until) : "") + 
            (!isnull(this.through) ? "through " + inspect(this.through) : "") + 
            (!isnull(this.before) ? "before " + inspect(this.before) : "") + 
            (!isnull(this.length) ? this.length : "") + 
            "]");
  }

  function equals(terminator, value) {
    if (isnull(terminator)) return false;
    if (typeof terminator != typeof value) {
      if (typeof terminator == typeof 1) 
        terminator = String.fromCharCode(terminator);
      if (typeof value == typeof 1) 
        value = String.fromCharCode(value);
    }
    return value === terminator;
  }

  this.deconstruct = function (context) {
    context.value = null;
    var e = element.dereference(context);
    var isstr = e.isAscii(context);
    var result = isstr ? "" : [];
    for (var i = 0; ; ++i) {
      if (context.eof()) break;
      if (!isnull(this.length) && i >= this.length) break;
      if (equals(this.before, context.peek())) break;
      var v = e.deconstruct(context);
      if (equals(this.until, context.value)) break;
      if (isstr)
        result += v;
      else
        result.push(v);
      if (equals(this.through, context.value)) break;
    }
    context.value = result;
    return context.value;
  }
}


function NumericType(basis) {
  this.basis = basis;

  function attr(context, key, defvalue) {
    if (!isnull(basis[key])) return basis[key];
    if (!isnull(context)) {
      if (!isnull(context.modifiers[key])) return context.modifiers[key];
      if (!isnull(context.defaults[key])) return context.defaults[key];
    }
    return defvalue;
  }

  function signed(context)    {  return attr(context, "signed", false);  }
  function size(context)      {  return attr(context, "size", 8);  }
  function bigendian(context) {  return attr(context, "bigendian", false);  }
  function base(context)      {  return attr(context, "base", 10);  }

  this.isAscii = function (context) {
    return base(context) == 256;
  }

  this.toString = function (context) {
    var result = (signed(context) ? "i" : "u") + size(context);
    if (bigendian(context)) result = result.toUpperCase();
    switch (base(context)) {
    case 0:   result += "n";  break;
    case 2:   result += "b";  break;
    case 256: result += "c";  break;
    }
    return result;
  }

  function negateByte(v) {
    // two's complement
    return (0xff - v + 1) * -1;
  }

  this.deconstruct = function (context) {
    context.value = 0;
    for (var i = 0; i < size(context); i += 8) {
      var v = context.bite();
      if (bigendian(context)) {
        if (signed(context) && i === 0 && (v & 0x80)) 
          v = negateByte(v);
        context.value <<= 8;
        context.value += v;
      } else {
        if (signed(context) && i === size(context) - 8 && (v & 0x80)) 
          v = negateByte(v);
        context.value |= v << i;
      }
    }
    if (base(context) === 256) 
      context.value = String.fromCharCode(context.value);
    else if (base(context) === 2) 
      context.value = !!context.value;
    else if (base(context) === 0)
      context.value = null;
    return context.value;
  }
}


function ModifiedType(key, value, underlying) {
  this.key = key;
  this.value = value;
  this.underlying = underlying;

  this.isAscii = function (context) {
    if (isnull(context)) context = { modifiers: {}, defaults: {} };
    var formervalue = context.modifiers[this.key];
    context.modifiers[this.key] = this.value;

    var result = this.underlying.isAscii(context);

    context.modifiers[this.key] = formervalue;
    return result;
  }

  this.toString = function (context) {
    if (isnull(context)) context = { modifiers: {}, defaults: {} };
    var formervalue = context.modifiers[this.key];
    context.modifiers[this.key] = this.value;

    var result = this.underlying.toString(context);

    context.modifiers[this.key] = formervalue;
    return result;
  }

  this.deconstruct = function (context) {
    var formervalue = context.modifiers[this.key];
    context.modifiers[this.key] = this.value;

    var result = this.underlying.deconstruct(context);

    context.modifiers[this.key] = formervalue;
    return result;
  }
}


function StructType() {

  function Field(name, value, type) {
    this.name = name;
    this.value = value;
    this.type = type;

    this.toString = function (context) {
      return (isnull(name) ? "" : name + " ") + 
             (isnull(value) ? "" : value + " ") + 
             type.toString(context);
    }
  }
  
  var fields = [];

  this.addField = function (name, value, type) {
    fields.push(new Field(name, value, type));
  }

  function pushScope(context) {
    var state = [context.defaults, context.modifiers];
    for (var k in context.modifiers) 
      if (context.modifiers.hasOwnAttribute(k))
        context.defaults[k] = context.modifiers[k];
    context.modifiers = {}
    return state;
  }

  function popScope(context, state) {
    context.defaults = state[0];
    context.modifiers = state[1];
  }

  this.toString = function (context) {
    if (isnull(context)) context = { modifiers: {}, defaults: {} };
    var formerstate = pushScope(context);
    var result = "{\n";
    for (var i = 0; i < fields.length; ++i) 
      result += fields[i].toString(context) + "\n";
    popScope(context, formerstate);
    return result + "}";
  }

  this.deconstruct = function (context) {
    var formerstate = pushScope(context);
    var result = {}
    for (var i = 0; i < fields.length; ++i) {
      var field = fields[i];
      var value = field.type.deconstruct(context);
      if (!isnull(field.value) && value !== field.value)
        throw new DeconError("Non-matching value: " + value + " expected: " + 
                             field.value, context);
      if (!isnull(field.name))
        result[field.name] = value;
    }
    popScope(context, formerstate);
    return (context.value = result);
  }
}

if (require.main === module) {
  runTests();
  main();
}