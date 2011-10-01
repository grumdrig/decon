
// TODO: change some parseValue's to parseExpression?
// TODO: get rid of "base"?
// TODO: make numerics default to size 8 so byte and int will be
//       unsigned and signed bytes
// TODO: just make standard typedefs without "import standard"

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
                       +  "([\\r\\n;])"            // 3.   \n
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
  testMatch(";", [ T.NEWLINE ]);
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
  
  return true;
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
CONSTANTS["null"] = makeValue(null);

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
      split("\n").length;
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
        if (tryToTake("standard")) {
          parse("int8: int.size 8;" +
                "int16: int.size 16;" +
                "int32: int.size 32;" +
                "uint: byte.unsigned.size(32);" +
                "uint8: uint.size 8;" +
                "uint16: uint.size 16;" +
                "uint32: uint.size 32;");
        } else {
          var filename = take(T.QUOTED);
          parseFile(filename);
        }
      } else {
        var name = take(T.IDENTIFIER);
        if (tryToTake(":")) {
          // Type def
          var type = parseType();
          TYPES[name] = type;
        } else {
          // Constant def
          take("=");
          var type = tryToParseType();
          var literal = parseValue();
          if (!isnull(type)) literal.type = type;
          CONSTANTS[name] = literal;
        }
      }
      
      if (!is(T.EOF)) takeNewlines();
    }
  };

  var parseType = this.parseType = function() {
    var type = tryToParseType();
    if (isnull(type)) throw new SyntaxError("Type expected");
    return type;
  };

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

    if (is("union") || is("{")) {
      // Struct/union      
      var s = new StructType(tryToTake("union"));
      take("{");
      for (maybeTakeNewlines(); !tryToTake("}"); ) {
        var fieldtype = tryToParseType();
        var fieldvalue = tryToParseValue(true);
        var fieldname = tryToTake(T.IDENTIFIER);
        if (isnull(fieldvalue) && isnull(fieldtype))
          throw new SyntaxError("Missing type in field specification");
        s.addField(fieldname, fieldvalue, fieldtype);

        while (tryToTake(",")) {
          fieldname = take(T.IDENTIFIER);
          s.addField(fieldname, fieldvalue, fieldtype);
        }
          
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
        for (;;) {
          if (isnull(result.until) && tryToTake("until")) {
            result.until = parseValue();
          } else if (isnull(result.through) && tryToTake("through")) {
            result.through = parseValue();
          } else if (isnull(result.before) && tryToTake("before")) {
            result.before = parseValue();
          } else if (isnull(result.index) && tryToTake("index")) {
            result.index = take(T.IDENTIFIER);
          } else {
            if (!isnull(result.length)) 
              break;
            result.length = tryToParseExpression();
            if (isnull(result.length))
              break;
          }
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


  var operators = "/*+-.[".split("");

  function parseExpression() {
    var r = tryToParseExpression();
    if (isnull(r))
      throw new SyntaxError("Numeric value expected");
    return r;
  }

  function tryToParseExpression() {
    var result = tryToParseValue();

    // TODO associativity rules
    if (!isnull(result)) while(operators.indexOf(is(T.PUNCTUATION)) >= 0) {
      var operator = take(T.PUNCTUATION);
      if (operator === "[") {
        var rhs = parseExpression();
        take("]");
      } else {
        var rhs = parseValue();
      }
      result = new ExpressionValue(result, operator, rhs);
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
  var mainname;
  var submains = [];
  var a = 0;
  var partialok = null;
  var verbose = null;
  var variable;
  var infile = '/dev/stdin';
  var outfile = null;
  var readable = null;
  for (; a < args.length; ++a) {
    var arg = args[a];

    if (arg === "-p") {
      partialok = true;

    } else if (arg == "-v") {
      verbose = true;

    } else if (arg == "-V") {
      variable = args[++a];

    } else if (arg == "-f") {
      submains = args[++a].split(".");

    } else if (arg === "-i") {
      infile = args[++a];

    } else if (arg === "-o") {
      outfile = args[++a];

    } else if (arg === "-h") {
      readable = true;

    } else if (arg.endsWith(".con")) {
      parseFile(arg);

    } else {
      // Must be a type
      if (!isnull(Main)) usage("Main already supplied");
      Main = parse(arg, "type");
    }
  }
  
  if (runTests() && verbose)
    console.error("PASS");

  if (isnull(Main))
    usage("No main type specified");

  try {
    if (verbose) {
      console.error("TYPES:");
      for (var k in TYPES)
        if (TYPES.hasOwnProperty(k))
          console.error(k + ": " + TYPES[k]);

      console.error("MAIN:");
      console.error("" + Main);
    }

    var tree = Main.deconstructFile(infile, partialok);
  } catch (de) {
    if (de instanceof DeconError) {
      // TODO print some more context
      console.error("DECON ERROR (@" + de.context.bitten + "): " +
                    de.problem);
      console.error(de.context.xxd());
      console.error(de.stack);
      process.exit(-2);
    } else {
      throw de;
    }
  }

  while (submains.length > 0)
    tree = tree[submains.shift()];

  if (readable)
    tree = inspect(tree, null, null);
  else 
    tree = JSON.stringify(tree);

  if (variable) 
    tree = "var " + variable + " = " + tree + ";";

  if (isnull(outfile))
    console.log(tree);
  else
    fs.writeFile(outfile, prefix + tree + suffix);
}


function usage(msg) {
  if (!isnull(msg)) console.error(msg);
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

  
var parse = exports.parse = function (string, what) {
  try {
    var p = new DeconParser(string);
    if (what == "type")
      return p.parseType();
    else
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

  this.xxd = function () {
    var result = "000000" + this.bitten.toString(16) + ": ";
    result = result.substr(result.length - 9);
    var chars = "";
    for (var i = this.bitten; i < this.bitten + 16 && i < buffer.length; ++i) {
      if (buffer[i] < 16) result += '0';
      result += buffer[i].toString(16);
      if ((i & 1) == 0) result += ' ';
      chars += buffer[i] < 32 ? "." : String.fromCharCode(buffer[i]);
    }
    return result + " " + chars;
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

  if (!isnull(optLen)) this.length = optLen;

  this.toString = function (context) {
    var terms = [];
    if (!isnull(this.length)) 
      terms.push(this.length.toString(context));
    if (!isnull(this.index)) 
      terms.push("index " + this.index);
    if (!isnull(this.until)) 
      terms.push("until " + this.until.toString(context));
    if (!isnull(this.through)) 
      terms.push("through "+ this.through.toString(context));
    if (!isnull(this.before)) 
      terms.push("before " + this.before.toString(context));
    return ("" + element.toString(context) + "[" + terms.join(" ") + "]");
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
    if (this.index)
      context.scope.unshift({});
    var isstr = element.isAscii(context);
    var result = isstr ? "" : [];
    for (var i = 0; ; ++i) {
      if (this.index)
        context.scope[0][this.index] = i;
      if (context.eof()) break;
      if (!isnull(this.length)) {
        var count = this.length.value(context)
        if (typeof count != typeof 1)
          throw new DeconError("Invalid array length: " + 
                               inspect(count), context);
        if (i >= count) break;
      }
      if (equals(this.before, context.peek(), context)) break;
      var v = element.deconstruct(context);
      if (equals(this.until, context.result, context)) break;
      if (isstr)
        result += v;
      else
        result.push(v);
      if (equals(this.through, context.result, context)) break;
    }
    context.result = result;
    if (this.index)
      context.scope.shift();
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


function StructType(union) {

  function Field(nam, val, typ) {
    this.name = nam;

    function value(context) {
      return isnull(val) ? null : val.value(context);
    }

    this.type = function (context) {
      if (!isnull(typ)) return typ;
      else return val.type(context);
    }

    this.toString = function (context) {
      return ((isnull(nam) ? "" : nam + " ") + 
              (isnull(val) ? "" : val.toString(context) + " ") + 
              this.type(context).toString(context));
    }

    this.verifyValue = function (against, context) {
      if (!isnull(value(context)) && value(context) !== against)
        throw new DeconError("Non-matching value. Expected: " + 
                             inspect(value(context)) + ", got:" + 
                             inspect(against), context);
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
    if (union) result = "union " + result;
    for (var i = 0; i < fields.length; ++i) 
      result += fields[i].toString(context) + "\n";
    popScope(context, formerstate);
    return result + "}";
  }

  this.deconstruct = function (context) {
    var formerstate = pushScope(context);
    var result = context.scope[0];
    var wasbitten = context.bitten;
    for (var i = 0; i < fields.length; ++i) {
      try {
        var field = fields[i];
        var type = field.type(context);
        var value = field.type(context).deconstruct(context);
        field.verifyValue(value, context);
        if (union) {
          result = value;
          break;
        }
        if (!isnull(field.name))
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
    } else if (operator === "[") {
      // Index
      var index = right.value(context);
      result = result[index];
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
    if (operator === "[")
      return left.toString(context) + "[" + right.toString(context) + "]";
    else
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
  else  {
    //throw new Error("Internal Error: Invalid parameter to makeValue: " + typeof value);
    return new LiteralValue(value, new ReferenceType("object"));
  }
}


if (require.main === module) {
  main();
}