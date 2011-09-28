
// TODO: change some parseValue's to parseExpression?
// TODO: indices on arrays
// TODO: get rid of "base"?

var fs = require("fs");
var inspect = require("util").inspect;

// Syntax error during .con file parsing
function SyntaxError(problem) {
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
                       +  "|([_a-zA-Z]\\w*)"       // 6.   identifier
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
  WHITESPACE   : 1,
  TOKEN        : 2,
  NEWLINE      : 3,
  QUOTED       : 4,
  SINGLEQUOTED : 5,
  IDENTIFIER   : 6,
  HEXNUMBER    : 7,
  NUMBER       : 8,
  PUNCTUATION  : 9,
  EOF          : 10,
  ILLEGAL      : 11
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

function testParseValue(input, expected) {
  try {
    var p = new DeconParser(input);
    var d = p.parseValue();
  } catch (e) {
    if (e instanceof SyntaxError)
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

  testMatch("lcid", [ T.IDENTIFIER ]);
  testMatch("UcId", [ T.IDENTIFIER ]);
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
  
  testParseValue("0", 0);
  testParseValue("6", 6);
  testParseValue("3", 3);
  testParseValue("(2*3)", 2*3);
  testParseValue("(3*2)", 3*2);
  testParseValue("(-2*3/26)", -2*3/26);
  testParseValue("0x20", 32);
  testParseValue("' '", 32);
  
  console.error("PASS");
}


var TYPES = {};
TYPES["byte"] = new AtomicType({});
TYPES["char"] = new AtomicType({base: 256});
TYPES["bool"] = new AtomicType({base: 2});
TYPES["null"] = new AtomicType({base: 0, size: 0});
TYPES["int"] = new ModifiedType("size", makeValue(32), 
                                new ModifiedType("signed", makeValue(true), 
                                                 new ReferenceType("byte")));
  
var CONSTANTS = {};


function DeconParser(text) {

  var tokenMatcher = new TokenMatcher(text);
  if (!tokenMatcher.lookingAt()) 
    throw new SyntaxError("Syntax error at start of file");

  function advance() {
    if (!tokenMatcher.find()) {
      throw new SyntaxError("Unrecognised input");
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
    if (typeof tokenTypeOrLiteral === typeof "") {
      return tokenMatcher.group(T.TOKEN) === tokenTypeOrLiteral;
    } else {
      var result = tokenMatcher.group(tokenTypeOrLiteral);
      if (!isnull(result) && !result)
        return true;  // Can't return the match as the truth value
      return result;
    }
  }

  function take(something) {
    if (isnull(something)) {
      var result = tokenMatcher.group(T.TOKEN);
      advance();
      return result;
    } else if (typeof something === typeof "") {
      var literal = something;
      if (!is(literal))
        throw new SyntaxError("Expected literal '" + literal + "'");
      return take();
    } else {
      var tokenType = something;
      var result = tokenMatcher.group(tokenType);
      if (isnull(result)) {
        throw new SyntaxError("Expected " + T[tokenType]);
      }
      advance();
      return result;
    }
  }


  function tryToTake(literal) {
    return (is(literal)) ? take(literal) : null;
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
        var name = take(T.IDENTIFIER);
        if (tryToTake(":")) {
          // Type def
          var type = parseType();
          TYPES[name] = type;
        } else {
          // Constant def
          take("=");
          var literal = parseValue();
          var type = tryToParseType();
          if (!isnull(type)) literal.type = type;
          CONSTANTS[name] = literal;
        }
      }
      
      if (!is(T.EOF)) takeNewlines();
    }
  }

  function parseType() {
    var type = tryToParseType();
    if (isnull(type)) throw new SyntaxError("Type expected");
    return type;
  }

  function tryToParseType() {
    if (tryToTake("unsigned")) {
      return new ModifiedType("signed", makeValue(false), parseType());
    } else if (tryToTake("signed")) {
      return new ModifiedType("signed", makeValue(true), parseType());
    } else if (tryToTake("size")) {
      return new ModifiedType("size", parseValue(), parseType());
    } else if (tryToTake("bigendian")) {
      return new ModifiedType("bigendian", makeValue(true), parseType());
    } else if (tryToTake("littleendian")) {
      return new ModifiedType("bigendian", makeValue(false), parseType());
    } else if (tryToTake("at")) {
      return new ModifiedType("at", parseValue(), parseType());
    } 

    if (tryToTake("{")) {
      // Struct
      var s = new StructType();
      for (maybeTakeNewlines(); !tryToTake("}"); ) {
        var fieldtype = tryToParseType();
        var fieldvalue = tryToParseValue(true);
        var fieldname = tryToTake(T.IDENTIFIER);
        if (isnull(fieldvalue) && isnull(fieldtype))
          throw new SyntaxError("Missing type in field specification");
        s.addField(fieldname, fieldvalue, fieldtype);
        if (tryToTake("}")) break;  // Allow closing brace w/o newline
        takeNewlines();
      }
      var result = s;
    } else if (is(T.IDENTIFIER)) {
      // Reference named type
      var result = new ReferenceType(take(T.IDENTIFIER));
    } else {
      return;
    }

    for (;;) {
      if (tryToTake(".")) {
        if (tryToTake("unsigned")) {
          result = new ModifiedType("signed", makeValue(false), result);
        } else if (tryToTake("signed")) {
          result = new ModifiedType("signed", makeValue(true), result);
        } else if (tryToTake("size")) {
          result = new ModifiedType("size", parseValue(), result);
        } else if (tryToTake("bigendian")) {
          result = new ModifiedType("bigendian", makeValue(true), result);
        } else if (tryToTake("littleendian")) {
          result = new ModifiedType("bigendian", makeValue(false), result);
        } else if (tryToTake("at")) {
          result = new ModifiedType("at", parseValue(), result);
        } else {
          throw new SyntaxError("Invalid type modifier");
        }
      } else if (tryToTake("[")) {
        result = new ArrayType(result);
        if (tryToTake("until")) {
          result.until = parseValue();
        } else if (tryToTake("through")) {
          result.through = parseValue();
        } else if (tryToTake("before")) {
          result.before = parseValue();
        } else {
          result.length = tryToParseValue();
        }
        take("]");
      } else {
        break;
      }
    }
    return result;
  }
                             

  var parseValue = this.parseValue = function (infield) {
    var r = tryToParseValue(infield);
    if (isnull(r))
      throw new SyntaxError("Numeric value expected");
    return r;
  }

  function tryToParseValue(infield) {

    if (is(T.NUMBER)) {
      return makeValue(parseInt(take()));

    } else if (is(T.HEXNUMBER)) {
      var hex = take(T.HEXNUMBER);
      return new LiteralValue(parseInt(hex, 16),
                              new ModifiedType("size",
                                               makeValue(4 * hex.length), 
                                               new ReferenceType("int")));

    } else if (is(T.SINGLEQUOTED)) {
      // TODO: deal with endianness and type-specifying and all that
      var s = JSON.parse('"' + take(T.SINGLEQUOTED) + '"');
      var value = 0;
      for (var i = 0; i < s.length; ++i)
        value = (value << 8) + (0xFF & s.charCodeAt(i));
      return new LiteralValue(value, new ModifiedType("size", 
                                                      makeValue(8 * s.length),
                                                      new ReferenceType("int")));

    } else if (is(T.QUOTED)) {
      var value = JSON.parse('"' + take(T.QUOTED) + '"');
      return new LiteralValue(value, new ArrayType(new ReferenceType("char"), 
                                                   makeValue(value.length)));

    } else if (!infield && is(T.IDENTIFIER)) {
      return new ReferenceValue(take(T.IDENTIFIER));
      
    } else if (tryToTake("(")) {
      var result = parseExpression();
      take(")");
      return result;

    } else {
      return null;
    }
  }


  var operators = "/*+-.".split("");

  function parseExpression() {
    var result = parseValue();

    // TODO associativity rules
    while (operators.indexOf(is(T.PUNCTUATION)) >= 0) {
      var operator = take(T.PUNCTUATION);
      result = new ExpressionValue(result, operator, parseValue());
    }

    return result;
  }

}


String.prototype.endsWith = function(suffix) {
  return this.indexOf(suffix, this.length - suffix.length) !== -1;
};


function main() {
  var args = process.argv.slice(2);
  var Main;
  var a = 0;
  var partialok = null;
  for (; a < args.length; ++a) {
    var arg = args[a];
    if (arg === "-p") {
      partialok = true;
    } else if (arg.endsWith(".con")) {
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
  
  if (isnull(Main))
    usage();

  try {
    console.error("TYPES:");
    for (var k in TYPES)
      if (TYPES.hasOwnProperty(k))
        console.error(k + ": " + TYPES[k]);

    console.error("MAIN:");
    console.error("" + Main);

    var tree = Main.deconstructFile(args[a++] || '/dev/stdin', partialok);
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
    if (e instanceof SyntaxError) {
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
    if (e instanceof SyntaxError) {
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
  this.result = null;
  this.modifiers = {};
  this.defaults = {};
  this.scope = [];

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

  this.deconstructFile = function (filename, partialok) {
    var inbuf = fs.readFileSync(filename);
    var context = new Context(inbuf);
    var result = this.deconstruct(context);
    if (isnull(partialok)) partialok = context.adjusted;
    if (!partialok && !context.eof())
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
Type.sire(AtomicType);
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



function ArrayType(element, optLen) {

  this.element = element;
  if (!isnull(optLen)) this.length = optLen;

  this.toString = function (context) {
    return ("" + this.element.toString(context) + "[" + 
            (isnull(this.until)  ? "" :
             "until " + this.until.toString(context)) + 
            (isnull(this.through)? "" :
             "through "+ this.through.toString(context)) + 
            (isnull(this.before) ? "" : 
             "before " + this.before.toString(context)) +
            (isnull(this.length) ? "" : 
             this.length.toString(context)) +
            "]");
  }

  function equals(terminator, value, context) {
    if (isnull(terminator)) return false;
    var term = terminator.value(context);
    if (typeof term != typeof value) {
      if (typeof term == typeof 1)  term = String.fromCharCode(term);
      if (typeof value == typeof 1) value = String.fromCharCode(value);
    }
    return value === term;
  }

  this.deconstruct = function (context) {
    context.result = null;
    var e = element.dereference(context);
    var isstr = e.isAscii(context);
    var result = isstr ? "" : [];
    for (var i = 0; ; ++i) {
      if (context.eof()) break;
      if (!isnull(this.length)) {
        var count = this.length.value(context)
        if (typeof count != typeof 1)
          throw new DeconError("Invalid array length: " + 
                               inspect(count), context);
        if (i >= count) break;
      }
      if (equals(this.before, context.peek(), context)) break;
      var v = e.deconstruct(context);
      if (equals(this.until, context.result, context)) break;
      if (isstr)
        result += v;
      else
        result.push(v);
      if (equals(this.through, context.result, context)) break;
    }
    context.result = result;
    return context.result;
  }
}


function AtomicType(basis) {
  function attr(context, key, defvalue) {
    if (!isnull(basis[key])) return basis[key];
    if (!isnull(context)) {
      if (!isnull(context.modifiers[key])) 
        return context.modifiers[key].value(context);
      if (!isnull(context.defaults[key])) 
        return context.defaults[key].value(context);
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
    context.result = 0;
    for (var i = 0; i < size(context); i += 8) {
      var v = context.bite();
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
    if (base(context) === 256) 
      context.result = String.fromCharCode(context.result);
    else if (base(context) === 2) 
      context.result = !!context.result;
    else if (base(context) === 0)
      context.result = null;
    return context.result;
  }
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
    if (this.key === "at") {
      return this.underlying.toString(context) + ".at(" + 
             this.value.toString(context) + ")";
    }
      
    if (isnull(context)) context = { modifiers: {}, defaults: {}, scope: [] };

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
    if (this.key === "at") {
      context.bitten = this.value.value(context);
      context.adjusted = true;
      return this.underlying.deconstruct(context);
    }

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


function StructType() {

  function Field(name, value, type) {
    this.name = name;

    this.type = function (context) {
      if (!isnull(type)) return type;
      else return value.type(context);
    }

    this.toString = function (context) {
      return ((isnull(name) ? "" : name + " ") + 
              (isnull(value) ? "" : inspect(value.value(context)) + " ") + 
              this.type(context).toString(context));
    }
  }
  
  var fields = [];

  this.addField = function (name, value, type) {
    fields.push(new Field(name, value, type));
  }

  function pushScope(context) {
    var state = [context.defaults, context.modifiers];
    for (var k in context.modifiers) 
      if (context.modifiers.hasOwnProperty(k))
        context.defaults[k] = context.modifiers[k];
    context.modifiers = {};
    context.scope.unshift({});
    return state;
  }

  function popScope(context, state) {
    context.defaults = state[0];
    context.modifiers = state[1];
    context.scope.shift();
  }

  this.toString = function (context) {
    if (isnull(context)) context = { modifiers: {}, defaults: {}, scope: [] };
    var formerstate = pushScope(context);
    var result = "{\n";
    for (var i = 0; i < fields.length; ++i) 
      result += fields[i].toString(context) + "\n";
    popScope(context, formerstate);
    return result + "}";
  }

  this.deconstruct = function (context) {
    var formerstate = pushScope(context);
    var result = context.scope[0];
    for (var i = 0; i < fields.length; ++i) {
      var field = fields[i];
      var type = field.type(context);
      console.log(">>>" + type);
      var value = field.type(context).deconstruct(context);
      if (!isnull(field.value) && value !== field.value.value())
        throw new DeconError("Non-matching value. Expected: " + 
                             field.value.value() +
                             ", got:" + inspect(value), context);
      if (!isnull(field.name))
        result[field.name] = value;
    }
    popScope(context, formerstate);
    return (context.result = result);
  }
}


function LiteralValue(value, type) {
  this.value = function (context) {
    return value;
  }
  
  this.type = function (context) {
    return type;
  }

  this.toString = function (context) {
    return inspect(this.value());
  }
}


function ReferenceValue(name) {
  this.value = function (context) {
    return dereference(context).value(context);
  }
  
  this.type = function (context) {
    return dereference(context).type(context);
  }

  this.toString = function (context) {
    return name;
  }

  function dereference(context) {
    for (var s = 0; s < context.scope.length; ++s)
      if (!isnull(context.scope[s][name]))
        return makeValue(context.scope[s][name]);
    var result = CONSTANTS[name];
    if (isnull(result))
      throw new DeconError("Undefined constant <" + name + ">", context);
    return result;
  }
}


function ExpressionValue(left, operator, right) {
  this.value = function (context) {
    var result = left.value(context);
    if (operator === ".") {
      // Field access
      context.scope.unshift(result);
      result = right.value(context);
      context.scope.shift();
    } else {
      // Arithmetic
      var rvalue = right.value(context);
      // TODO: auto type conversion?
      switch (operator) {
      case "+":  result += rvalue;  break;
      case "-":  result -= rvalue;  break;
      case "*":  result *= rvalue;  break;
      case "/":  result /= rvalue;  break;
      default: throw new DeconError("Internal Error: unknown operator", context);
      }
    }
    return result;
  }

  this.type = function (context) {
    return ReferenceType("null");  // frankly, this would be a mess.
  }

  this.toString = function (context) {
    return "(" + left.toString(context) + " " + operator + " " + 
                right.toString(context) + ")";
  }

}


function makeValue(value) {
  if (isnull(value))
    return new LiteralValue(value, new ReferenceType("null"));
  else if (typeof value == typeof true)
    return new LiteralValue(value, new ReferenceType("bool"));
  else if (typeof value == typeof 1)
    return new LiteralValue(value, new ReferenceType("int"));
  else 
    throw new Error("Internal Error: Invalid parameter to makeValue");
}


if (require.main === module) {
  runTests();
  main();
}