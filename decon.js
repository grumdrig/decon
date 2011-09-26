
// TODO: get rid of case-significance for types vs fields, etc
// TODO: constants
// TODO: probably want a string type
// TODO: use a context for dereferencing

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
function DeconError(problem) {
  this.problem = problem;
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
var punctRegex = "[-\\.*/+={}\\[\\]]";
                

function TokenMatcher(input) {
  this.input = input;
  
  this.re = new RegExp("^"                         //    beginning at last match:
                       +"([ \t]*(?:#.*)?)"         // 1. spaces & comments before
                       +"("                        // 2. any token: (
                       +  "([\\r\\n])"             // 3.   \n
                       +  "|\"(.*)\""              // 4.   quoted
                       +  "|([_a-z]\\w*)"          // 5.   lcid
                       +  "|([A-Z]\\w*)"           // 6.   ucid
                       +  "|0[xX]([0-9a-fA-F]+)"   // 7.   hex constant
                       +  "|("+intRegex+")"        // 8.   numerical constant
                       +  "|("+punctRegex+")"      // 9.   punctuation
                       +  "|($)"                   // 10.  EOF
                       +  "|(.)"                   // 11.  illegal
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
  WHITESPACE : 1,
  TOKEN      : 2,
  NEWLINE    : 3,
  QUOTED     : 4,
  LCID       : 5,
  UCID       : 6,
  HEXNUMBER  : 7,
  NUMBER     : 8,
  PUNCTUATION: 9,
  EOF        : 10,
  ILLEGAL    : 11
};

// Reverse-lookup of token types
for (var i in T)
  if (T.hasOwnProperty(i)) 
    T[T[i]] = i;


function isnull(x) {
  return (x == null || x == undefined || 
          typeof x == 'undefined' || typeof x == 'null');
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
  
  console.error("PASS");
}


var types = {};
// One predefined type
var Int = new NumericType({
    signed: true,
    size: 32,
    bigendian: false,
    base:  10});
types["Int"] = Int;

function dereferenceType(t) {
  for (; t instanceof ReferenceType;) {
    var name = t.name;
    t = types[name];
    if (isnull(t))
      throw new ParseError("Unknown type " + name);
  }
  return t;
}     

  
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
    if (typeof tokenTypeOrLiteral == typeof "")
      return tokenMatcher.group(T.TOKEN) == tokenTypeOrLiteral;
    else
      return tokenMatcher.group(tokenTypeOrLiteral) != null;
  }

  function take(something) {
    if (isnull(something)) {
      var result = tokenMatcher.group(T.TOKEN);
      advance();
      return result;
    } else if (typeof something == typeof "") {
      var literal = something;
      if (!is(literal))
        throw new ParseError("Expected literal '" + literal + "'");
      return take();
    } else {
      var tokenType = something;
      var result = tokenMatcher.group(tokenType);
      if (isnull(result)) {
        debugger;
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
        take("=");
        var type = parseType();
        types[name] = type;
      }
      
      if (!is(T.EOF)) takeNewlines();
    }
  }

  function parseType() {
    if (tryToTake("{")) {
      // Struct
      var s = new StructType();
      for (maybeTakeNewlines(); !tryToTake("}"); ) {
        var fieldname = take(T.LCID);
        var fieldtype = parseType();
        s.addField(fieldname, fieldtype);
        takeNewlines();
      }
      var result = s;
    } else {
      // Reference named type
      var result = new ReferenceType(take(T.UCID));
    }

    while (tryToTake(".")) {
      // TODO: hold the reference so that the underlying type can be changed to
      // affect all descendants (endianness is what I'm thinking about here,
      // but that also allows forward references)
      result = dereferenceType(result);
      //if (!(result instanceof NumericType))
      //  throw new ParseError("Numeric type expected; got " + result.prototype);
      var nt = new NumericType(result);
      var modifier = take(T.LCID);
      if (modifier == "signed") {
        nt.signed = true;
      } else if (modifier == "unsigned") {
        nt.signed = false;
      } else if (modifier == "size") {
        nt.size = parseNumeric();
      } else if (modifier == "bigendian") {
        nt.bigendian = true;
      } else if (modifier == "littleendian") {
        nt.bigendian = false;
      } else if (modifier == "base") {
        nt.base = parseNumeric();
      } else if (modifier == "ascii") {
        nt.base = 256;
      } else {
        throw new ParseError("Unknown type modifier");
      }
      result = nt;
    }
        
    while (tryToTake("[")) {
      result = new ArrayType(result);
      if (tryToTake("until")) {
        result.until = parseNumeric();
      } else if (tryToTake("before")) {
        result.before = parseNumeric();
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
}


String.prototype.endsWith = function(suffix) {
  return this.indexOf(suffix, this.length - suffix.length) !== -1;
};


function main() {
  var args = process.argv.slice(2);
  var main;
  var a = 0;
  for (; a < args.length; ++a) {
    var arg = args[a];
    if (arg.endsWith(".con")) {
      parseFile(arg);
    } else {
      // Must be a type
      main = types[arg];
      if (isnull(main)) {
        // Don't know it - look for a .con file
        if (fs.statSync(arg + ".con").isFile())
          parseFile(arg + ".con");
        main = types[arg];
      }
      if (isnull(main)) {
        console.error("Construction not found: " + arg);
        process.exit(404);
      }
      ++a;
      break;
    }
  }
  
  if (isnull(main)) usage();


  if (a < args.length) {
    try {
      var inbuf = fs.readFileSync(args[a++]);
    } catch (e) {
      console.error("Error reading input file: " + args[a-1]);
      process.exit(404);
    }
  } else {
    throw new Error("Read from stdin unimplemented");
  }

  //
  //if (a < args.length)
  //  fout = fs.openSync(args[a++], 'w');

  if (a < args.length)
    usage();

  console.error("TYPES:");
  for (var k in types)
    if (types.hasOwnProperty(k))
      console.error(k + ": " + types[k]);

  console.error("MAIN:");
  console.error(""+main);
  
  var context = new Context(inbuf);
  try {
    var tree = main.deconstruct(context);
    console.log(JSON.stringify(tree));
  } catch (de) {
    // TODO print some more context
    console.error("DECONSTRUCTION ERROR @ " + context.bitten + ": " +
                  de.problem);
    console.error(de.stack);
    process.exit(-2);
  }
}


function usage() {
  console.error("Usage: java DeconParser [DEF.con...] MAIN [IN [OUT]]");
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

function parseFile(filename) {
  var program = readFile(filename);
  assert(program);
  try {
    var p = new DeconParser(program);
    p.go();
  } catch (e) {
    if (e instanceof ParseError) {
      debugger;
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


function Context(buffer) {
  var bitten = 0;

  this.value = null;

  this.bite = function () {
    return buffer[bitten++];
  }

  this.peek = function () {
    return buffer[bitten];
  }
    
  this.eof = function () {
    return bitten >= buffer.length;
  }

  this.length = function () {
    return buffer.length;
  }
}



function Type() {
  this.dereference = function () { return this; }
}



function ReferenceType(name) {
  this.prototype = new Type();

  this.name = name;
  
  this.dereference = function () {
    var result = types[name];
    if (!isnull(result)) result = result.dereference();
    return result;
  }

  this.toString = function () {
    var t = this.dereference();
    if (isnull(t))
      return name + ":???";
    else
      return t.toString();
  }

  this.deconstruct = function(context) {
    var t = types[name];
    if (isnull(t))
      throw new DeconError("Undefined type " + name);
    return t.deconstruct(context);
  }
}



function ArrayType(element) {
  this.prototype = new Type();

  this.element = element;

  this.toString = function () {
    return ("" + this.element + "[" + 
            (!isnull(this.until) ? "until " + this.until : "") + 
            (!isnull(this.before) ? "before " + this.before : "") + 
            (!isnull(this.length) ? this.length : "") + 
            "]");
  }

  this.deconstruct = function (context) {
    context.value = null;
    var e = element.dereference();
    var isstr = (e.base == 256);
    var result = isstr ? "" : [];
    for (var i = 0; ; ++i) {
      if (!isnull(this.length) && i >= this.length) break;
      if (!isnull(this.until)  && context.value == this.until) break;
      if (!isnull(this.before) && context.peek() == this.before) break;
      if (isnull(this.length) && isnull(this.until) && isnull(this.before) && 
          context.eof()) break;
      var v = e.deconstruct(context);
      if (isstr)
        result += v;
      else
        result.push(v);
    }
    context.value = result;
    return context.value;
  }
}


function NumericType(basis) {
  NumericType.prototype = new Type();

  this.signed = basis.signed;
  this.size = basis.size;
  this.bigendian = basis.bigendian;
  this.base = basis.base;

  this.toString = function () {
    var result = (this.signed ? "i" : "u") + this.size;
    if (this.bigendian) result = result.toUpperCase();
    if (this.base != 10) result += "%" + this.base;
    return result;
  }

  function negateByte(v) {
    // two's complement
    return (0xff - v + 1) * -1;
  }

  this.deconstruct = function (context) {
    context.value = 0;
    for (var i = 0; i < this.size; i += 8) {
      var v = context.bite();
      if (this.bigendian) {
        if (this.signed && i == 0 && (v & 0x80)) v = negateByte(v);
        context.value <<= 8;
        context.value += v;
      } else {
        if (this.signed && i == this.size - 8 && (v & 0x80)) v = negateByte(v);
        context.value |= v << i;
      }
    }
    if (this.base == 256) 
      context.value = String.fromCharCode(context.value);
    return context.value;
  }
}


function StructType() {
  this.prototype = new Type();

  function Field(name, type) {
    this.name = name;
    this.type = type;

    this.toString = function () {
      return name + " " + type;
    }
  }
  
  var fields = [];

  this.addField = function (name, type) {
    fields.push(new Field(name, type));
  }

  this.toString = function () {
    var result = "{\n";
    for (var i = 0; i < fields.length; ++i) 
      result += fields[i] + "\n";
    return result + "}";
  }

  this.deconstruct = function (context) {
    var result = {}
    for (var i = 0; i < fields.length; ++i) {
      var field = fields[i];
      result[field.name] = field.type.deconstruct(context);
    }
    return (context.value = result);
  }
}

runTests();

main();