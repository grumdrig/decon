
// TODO: get rid of case-significance for types vs fields, etc
// TODO: constants
// TODO: probably want a string type
// TODO: use a context for dereferencing

var fs = require("fs");

// Syntax error during .con file parsing
function ParseError(problem) {
  this.problem = problem;
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
var punctRegex = "[-\\.*/+]";
                

function TokenMatcher(input) {
  this.input = input;
  
  this.re = new RegExp("^"                         //    beginning at last match:
                       +"([ \t]*(?:#.*)?)"         // 1. spaces & comments before
                       +"("                        // 2. any token: (
                       +  "([\\r\\n])"             // 3.   \n
                       +  "|\"(.*)\""              // 4.   quoted
                       +  "|([_a-z][-\\w]*)"       // 5.   lcid
                       +  "|([A-Z][-\\w]*)"        // 6.   ucid
                       +  "|0[xX]([0-9a-fA-F]+)"   // 7.   hex constant
                       +  "|("+intRegex+")"        // 8.   numerical constant
                       +  "|("+punctRegex+")"      // 9.   punctuation
                       +  "|($)"                   // 10.  EOF
                       +")", "m");                 //    )  multiline

  this.find = function () {
    this.match = this.re.exec(this.input.substr(this.pos));
    if (this.match) {
      this.pos += this.match[0].length;
    }
    return this.match;
  }
  
  this.groupCount = function () { return this.this.match.length; }

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
  EOF        : 10
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

function runTests() {
  var assert = require("assert").ok;
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
var Int = new NumericType();
Int.signed = true;
Int.size = 32;
Int.bigendian = false;
Int.base = 10;
types["Int"] = Int;

function dereferenceType(t) {
  for (; t instanceof ReferenceType;) {
    var name = t.name;
    t = types.get(name);
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
        var what;
        switch (tokenType) {
        case T.WHITESPACE:
          what = "whitespace";
          break;
        case T.NEWLINE:
          what = "newline";
          break;        
        case T.QUOTED:
          what = "quoted string";
          break;
        case T.LCID:
          what = "identifier";
          break;
        case T.UCID:
          what = "Identifier";
          break;
        case T.NUMBER:
          what = "number";
          break;
        case T.PUNCTUATION:
          what = "punctuation";
          break;
        case T.EOF:
          what = "end of file";
          break;
        default:
          what = "token type " + tokenType;
          break;
        }
        throw new ParseError("Expected " + what);
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

  function go() {
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
      if (!(result instanceof NumericType))
        throw new ParseError("Numeric type expected");
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
        main = types.get(arg);
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

  var fin = process.stdin;
  var fout = process.stdout;
  if (a < args.length) {
    var fin = fs.openSync(args[a++], 'r');
    var err = fin.shift(); 
    if (err) {
      console.error("Input file not found: " + args[a-1]);
      process.exit(404);
    }
  }

  if (a < args.length)
    fout = fs.openSync(args[a++], 'w');

  if (a < args.length)
    usage();

  for (var k in types)
    if (types.hasOwnProperty(k))
      console.error(k + ": " + types[k]);

  console.error(main);
  
  var context = new Context(fin, fout);
  try {
    main.deconstruct(context);
  } catch (de) {
    // TODO print some more context
    console.error("DECONSTRUCTION ERROR @ " + context.bitten + ": " +
                  de.problem);
    //de.printStackTrace();
    process.exit(-2);
  }
}


function usage() {
  console.error("Usage: java DeconParser [DEF.con...] MAIN [IN [OUT]]");
  process.exit(302);
}


function readFile(filename) {
  try {
    return fs.readFileSync(filename);
  } catch (IOException) {
    console.error("Error reading file: '" + filename + "'");
    process.exit(1);
    return null;
  }
}

function parseFile(filename) {
  var program = readFile(filename);
  try {
    var p = new DeconParser(program);
    p.go();
  } catch (ParseError) {
    // TODO add context
    var lineno = program.substring(0, 
                 p.tokenMatcher.start()).replaceAll("[^\n]", "").length() + 1;
    console.error("SYNTAX ERROR [" + filename + ":" + 
                  lineno + "]: " + 
                  e.problem + " at '" + p.tokenMatcher.group(T.TOKEN) + "'");
    //e.printStackTrace(process.stderr);
    process.exit(-1);
  }
}


function Context(fin, out) {
  var bitten = 0;
  var bit = 0;
  var buffer = "";

  var value = 0;

  this.print = function (value) {
    if (!isnull(out)) out.print(value);
  }
  
  this.println = function (value) {
    if (!isnull(out)) out.println(value);
  }

  this.printf = function () {
    if (!isnull(out)) out.printf.call(arguments);
  }

  this.bite = function() {
    if (buffer.length > 0) {
      var result = buffer.charCodeAt(0);
      buffer = buffer.substr(1);
      ++bitten;
      return result;
    }

    try {
      bit = fin.read();
    } catch (e) {
      throw new DeconError("Input error");
    }
    if (bit == -1)
      throw new DeconError("EOF");
    ++bitten;
    return bit;
  }


  this.peek = function () {
    if (eof()) return -1;  // fills the buffer
    return buffer.charCodeAt(0);
  }
    

  this.eof = function () {
    if (buffer.length > 0) return false;
    try {
      buffer += fin.read();
    } catch (e) {
      throw new DeconError("Input error");
    }
    if (buffer == -1) {
      buffer = null;
      return true;
    } else {
      return false;
    }
  }
}



function Type() {
  this.dereference = function () { return this; }
}



function ReferenceType(name) {
  this.prototype = Type.prototype;

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
    t.deconstruct(context);
  }
}



function ArrayType(element) {

  this.element = element;

  this.toString = function () {
    return ("" + this.element + "[" + 
            (!isnull(this.until) ? "until " + until : "") + 
            (!isnull(this.before) ? "before " + until : "") + 
            (!isnull(this.length) ? length : "") + 
            "]");
  }

  this.deconstruct = function (context) {
    context.value = null;
    var e = element.dereference();
    var isstr = 
      (e instanceof NumericType) &&
      (e.base == 256);
    context.print(isstr ? "\"" : "[");
    for (var i = 0; ; ++i) {
      if (!isnull(this.length) && i >= this.length) break;
      if (!isnull(this.until)  && context.value == this.until) break;
      if (!isnull(this.before) && context.peek() == this.before) break;
      if (is(length) && isnull(until) && isnull(before) && context.eof()) 
        break;
      if (!isstr && i > 0) context.print(", ");
      e.deconstruct(context);
    }
    context.print(isstr ? "\"" : "]");
  }
}


function NumericType() {
  this.prototype = Type;

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
    for (var i = 0; i < size; i += 8) {
      var v = context.bite();
      if (this.bigendian) {
        if (this.signed && i == 0) v = negateByte(v);
        context.value <<= 8;
        context.value += v;
      } else {
        if (this.signed && i == size - 8) v = negateByte(v);
        context.value |= v << i;
      }
    }
    if (this.base == 256) {
      if (context.value == '\\') {
        context.print("\\\\");
      } else if (context.value == '"') {
        context.print("\\\"");
      } else if (context.value < 32 || context.value > 127) {
        context.printf("\\u%04x", context.value);
      } else {
        context.printf("%c", context.value);
      }
    } else {
      context.print(context.value);
    }
  }
}


function StructType() {
  this.prototype = Type;

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
      result += field + "\n";
    return result + "}";
  }

  this.deconstruct = function (context) {
    context.println("{");
    for (var i = 0; i < fields.length; ++i) {
      var field = fields[i];
      if (i > 0)
        context.println(",");
      context.print("\"" + field.name + "\":");
      field.type.deconstruct(context);
    }
    context.println("}");
  }
}

runTests();

main();