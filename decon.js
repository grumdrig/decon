#!/usr/bin/env node
// TODO: change some parseValue's to parseExpression?
// TODO: get rid of "base"?
// TODO: bigint. see https://github.com/substack/node-bigint
//                or https://github.com/dankogai/js-math-bigint

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
var punctRegex = "[\\.{}\\[\\]()]";
                

function TokenMatcher(input) {
  this.input = input;
  
  this.re = new RegExp("^"                         //    beginning at last match:
                       +"([ \t]*(?:#.*)?)"         // 1. spaces & comments before
                       +"("                        // 2. any token: (
                       +  "([\\r\\n;])"            // 3.   \n
                       +  '|"((?:[^"\\\\]|\\\\.)*)"'   // 4.   quoted
                       +  "|'((?:[^'\\\\]|\\\\.)*)'"   // 5.   single-quoted
                       +  "|([_a-zA-Z]\\w*)"       // 6.   identifier
                       +  "|0[xX]([0-9a-fA-F]+)"   // 7.   hex constant
                       +  "|("+intRegex+")"        // 8.   numerical constant
                       +  "|([-*/+=:<>&|]+)"       // 9.   operators
                       +  "|("+punctRegex+")"      // 10.   punctuation
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
    return this.find();
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
  OPERATOR     : 9,
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

function testParseValue(input, expected) {
  var d = parse(input, "value");

  /*
  if (!p.is(T.EOF)) {
    console.error("Numeric test parse dangling stuff for '" + input + "'");
    process.exit(-8);
  }
  */
  var context = { modifiers: {}, defaults: {}, scope: [] };
  if (!equal(d.value(context), expected)) {
    console.error("Unexpected value " + d.toString(context) + " expected " + 
                  inspect(expected) + " for " + inspect(input));
    process.exit(-9);
  }
}

var assert = require("assert")

function runTests() {
  assert.equal(evalString("egg$"), "egg$");
  assert.equal(evalString("\\r\\n"), "\r\n");
  assert.equal(evalString("\\x7").charCodeAt(0), 7);
  assert.equal(evalString("\\7").charCodeAt(0), 7);
  assert.equal(evalString("\\007\\008").charCodeAt(0), 7);
  assert.equal(evalString("\\007\\010").charCodeAt(1), 8);
  assert.equal(evalString("\\b").charCodeAt(0), 8);
  
  assert.ok(isnull(runTests['nothing']));
  assert.ok(!isnull(runTests));
  assert.ok(isnull(null));
  assert.ok(isnull(undefined));

  testMatch("lcid", [ T.IDENTIFIER ]);
  testMatch("UcId", [ T.IDENTIFIER ]);
  testMatch("6", [ T.NUMBER ]);
  testMatch(".", [ T.PUNCTUATION ]);
  testMatch("\"la la la\"", [ T.QUOTED ]);
  testMatch("\n", [ T.NEWLINE ]);
  testMatch(";", [ T.NEWLINE ]);
  testMatch("0x0", [ T.HEXNUMBER ]);
  testMatch("0XABC", [ T.HEXNUMBER ]);
  testMatch("*", [ T.OPERATOR ]);
  testMatch("=", [ T.OPERATOR ]);
  testMatch("* =", [ T.OPERATOR, T.OPERATOR ]);
  testMatch(" {} ", [ T.PUNCTUATION, T.PUNCTUATION ]);
  testMatch(" $$ ", [ T.ILLEGAL, T.ILLEGAL ]);
  testMatch("{key:value}", [T.PUNCTATION, T.IDENTIFER, T.OPERATOR, T.IDENTIFIER,
                            T.PUNCTUATION]);
  
  testParseValue("0", 0);
  testParseValue("6", 6);
  testParseValue("3", 3);
  testParseValue("(2*3)", 2*3);
  testParseValue("(3*2)", 3*2);
  testParseValue("(-2*3/26)", -2*3/26);
  testParseValue("0x20", 32);
  testParseValue("' '", 32);
  testParseValue("\"\r\n\"", "\r\n");
  
  return true;
}


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
        var filename = take(T.QUOTED);
        parseFile(filename);

      } else if (tryToTake("<")) {
        take("script"); take(">");
        var match = /^([\s\S]*?)<\/script>/
          .exec(tokenMatcher.input.substr(tokenMatcher.pos));
        if (isnull(match)) throw new SyntaxError("Missing </script>");
        tokenMatcher.pos += match[0].length;
        var script = match[1];
        process.binding("evals").Script.runInNewContext(script, GLOBALS);
        advance();

      } else {
        var name = take(T.IDENTIFIER);
        if (tryToTake(":")) {
          // Type def
          var type = parseType();
          TYPES[name] = type;

        } else {
          // Constant def
          take("=");
          CONSTANTS[name] = parseExpression();
        }
      }
      
      if (!is(T.EOF)) takeNewlines();
    }
  };

  var MODIFIERS = ["size", "at", "select", "check", "if", "load", 
                   "deconstruct"];
  var UNARYMODS = {
    unsigned: ["signed", false],
    signed: ["signed", true],
    bigendian: ["bigendian", true],
    littleendian: ["bigendian", false]
  };

  var parseType = this.parseType = function() {
    var type = tryToParseType();
    if (isnull(type)) throw new SyntaxError("Type expected");
    return type;
  };

  function tryToParseType() {
    if (MODIFIERS.indexOf(is(T.IDENTIFIER)) >= 0) {
      return new ModifiedType(take(T.IDENTIFIER), parseValue(), parseType());
    } else if (!isnull(UNARYMODS[is(T.IDENTIFIER)])) {
      var m = UNARYMODS[take(T.IDENTIFIER)];
      return new ModifiedType(m[0], makeValue(m[1]), parseType());
    } else if (tryToTake("cast")) {
      take("(");
      var to = parseType();
      take(")");
      return new ModifiedType("cast", new LiteralValue(null, to), parseType());
    } 

    if (is("union") || is("{")) {
      // Struct/union      
      var union = tryToTake("union");
      var s = new StructType(union);
      take("{");
      for (maybeTakeNewlines(); !tryToTake("}"); ) {
        var fieldtype = tryToParseType();
        if (isnull(fieldtype)) {
          var fieldvalue = tryToParseValue(true);
          if (isnull(fieldvalue)) 
            throw new SyntaxError("Field type (or value) expected");
          fieldtype = new CheckedType(fieldvalue, fieldvalue.type());
        }
        if (!union)
          var fieldname = tryToTake(T.IDENTIFIER);
        s.addField(fieldname, fieldtype);

        while (tryToTake(",")) {
          fieldname = take(T.IDENTIFIER);
          s.addField(fieldname, fieldtype);
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
        if (MODIFIERS.indexOf(is(T.IDENTIFIER)) >= 0) {
          result = new ModifiedType(take(T.IDENTIFIER), parseValue(), result);
        } else if (tryToTake("cast")) {
          take("(");
          var to = parseType();
          take(")");
          result = new ModifiedType("cast", new LiteralValue(null, to), result);
        } else {
          var mname = take(T.IDENTIFIER);
          var m = UNARYMODS[mname];
          if (isnull(m))
            throw new SyntaxError("Invalid type modifier: " + mname);
          result = new ModifiedType(m[0], makeValue(m[1]), result);
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

    var check = tryToParseValue(true);
    if (!isnull(check)) 
      result = new CheckedType(check, result);

    return result;
  }
                             

  var parseValue = this.parseValue = function (infield) {
    var r = tryToParseValue(infield);
    if (isnull(r))
      throw new SyntaxError("Value expected");
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
                                               new ReferenceType("byte")));

    } else if (is(T.SINGLEQUOTED)) {
      // TODO: deal with endianness and type-specifying and all that
      var s = evalString(take(T.SINGLEQUOTED));
      var value = 0;
      for (var i = 0; i < s.length; ++i)
        value = (value << 8) + (0xFF & s.charCodeAt(i));
      return new LiteralValue(value, new ModifiedType("size", 
                                                      makeValue(8 * s.length),
                                                     new ReferenceType("byte")));

    } else if (is(T.QUOTED)) {
      var value = evalString(take(T.QUOTED));
      return new LiteralValue(value, new ArrayType(new ReferenceType("char"), 
                                                   makeValue(value.length)));

    } else if (tryToTake("{")) {
      // Object literal
      var keys = [], values = [];
      maybeTakeNewlines();
      if (!tryToTake("}")) for (;; take(",")) {
        maybeTakeNewlines();
        keys.push(parseExpression());
        take(":");
        values.push(parseExpression());
        maybeTakeNewlines();
        if (tryToTake("}")) break;
      }
      return new MapValue(keys, values);

    } else if (tryToTake("[")) {
      var values = [];
      if (!tryToTake("]")) for (;; take(",")) {
        values.push(parseExpression());
        if (tryToTake("]")) break;
      }
      return new ArrayValue(values);

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


  var operators = "/*+-.[=<>&|(".split("").concat([">>", "<<"]);

  function parseExpression() {
    var r = tryToParseExpression();
    if (isnull(r))
      throw new SyntaxError("Numeric value expected");
    return r;
  }

  function tryToParseExpression() {
    var result;

    result = tryToParseValue();

    // TODO associativity rules
    if (!isnull(result)) while(operators.indexOf(is(T.TOKEN)) >= 0) {
      var operator = take();
      if (operator === "[") {
        var rhs = parseExpression();
        take("]");
      } else if (operator === "(") {
        var rhs = [];
        if (!tryToTake(")")) {
          for (;;) {
            rhs.push(parseExpression());
            if (!tryToTake(","))
              break;
          }
          take(")");
        }
      } else {
        var rhs = parseValue();
      }
      result = new ExpressionValue(result, operator, rhs);
    }

    if (tryToTake("as"))
      result.type = parseType();

    return result;
  }

}


String.prototype.endsWith = function(suffix) {
  return this.indexOf(suffix, this.length - suffix.length) !== -1;
};


function main() {
  runTests();

  var args = process.argv.slice(2);
  var Main;
  var mainname;
  var submains = [];
  var a = 0;
  var partialok = null;
  var verbose = 0;
  var variable;
  var infile = '/dev/stdin';
  var outfile = null;
  var readable = null;
  for (; a < args.length; ++a) {
    var arg = args[a];

    if (arg === "-p") {
      partialok = true;

    } else if (arg == "-v") {
      ++verbose;

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
  
  if (isnull(Main))
    usage("No main type specified");

  try {
    if (verbose) {
      if (verbose > 1) {
        console.error("TYPES:");
        for (var k in TYPES)
          if (TYPES.hasOwnProperty(k))
            console.error(k + ": " + TYPES[k]);
      }

      console.error("MAIN:");
      console.error(Main.toString(new Context()));
    }

    var tree = Main.deconstructFile(infile, partialok);
  } catch (de) {
    if (de instanceof DeconError) {
      if (isnull(de.context)) {
        console.error("NO CONTEXT!");
        de.context = { bitten: -1, xxd: function () {} };
      }
          
      // TODO print some more context
      console.error("DECON ERROR (@" + de.context.bitten + "): " +
                    de.problem);
      console.error(de.context.xxd());
      console.error(de.context.stack);
      console.error(de.context.scope);
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
    fs.writeFile(outfile, tree);
}


function usage(msg) {
  if (!isnull(msg)) console.error(msg);
  console.error("Usage: node decon.js [DEF.con...] MAIN [IN [OUT]]");
  process.exit(302);
}


function readFile(filename) {
  try {
    return fs.readFileSync(filename, 'utf8');
  } catch (e) {
    console.error("Error reading file: '" + filename + "'");
    console.log(e);
    process.exit(1);
    return null;
  }
}

function evalString(s) {
  // Evaluate escape sequences in string s
  var result = "";
  for (var i = 0; i < s.length; ++i) {
    var c = s[i];
    if (c === '\\') {
      switch(s[++i]) {
      case 'b':  result += '\b';  break;
      case 'f':  result += '\f';  break;
      case 'n':  result += '\n';  break;
      case 'r':  result += '\r';  break;
      case 't':  result += '\r';  break;
        // TODO: these aren't very robust
      case 'u':  
        result += String.fromCharCode(parseInt(s.substr(++i, 4), 16));  
        i += 3;  
        break;
      case '0':
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
        result += String.fromCharCode(parseInt(s.substr(i, 3), 8));
        i += 2;  
        break;
      case 'x':  
        result += String.fromCharCode(parseInt(s.substr(++i, 2), 16));
        i += 1;  
        break;
      default:   result += c;     break;
      }
    } else {
      result += c;
    }
  }
  return result;
}


var parseFile = exports.import = function (filename) {
  var program = readFile(filename);
  assert.ok(!isnull(program));
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
    else if (what === "value")
      return p.parseValue();
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
  this.scope = [GLOBALS];
  this.stack = [];
  this.indent = 0;

  this.bite = function () {

    return buffer[this.bitten++];
  }

  this.peek = function () {
    return buffer[this.bitten];
  }
    
  this.eof = function () {
    return this.bitten >= buffer.length && isnull(this.bits);
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
      if (((i-this.bitten) & 1) == 1) result += ' ';
      chars += (buffer[i] < 32 || buffer[i] >= 128) ? "." : 
        String.fromCharCode(buffer[i]);
    }
    return result + " " + chars;
  };

}



function Type() {}

Type.prototype.deconstructFile = function (filename, partialok) {
  var inbuf = fs.readFileSync(filename);
  var context = new Context(inbuf);
  var result = this.deconstruct(context);
  if (isnull(partialok)) partialok = context.adjusted;
  if (!partialok && !context.eof())
    throw new DeconError("Unconsumed data [" + (context.length() - context.bitten) + "] at end of file " + filename, context);
  return result;
};

Type.prototype.isAscii = function (context) { return false; };

Type.prototype.dereference = function (context) { return this; };


ReferenceType.prototype = new Type();
ArrayType.prototype = new Type();
AtomicType.prototype = new Type();
ModifiedType.prototype = new Type();
StructType.prototype = new Type();
CheckedType.prototype = new Type();


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
  };

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
      if (!isnull(this.length)) {
        var count = this.length.value(context)
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
  };

  this.toString = function (context) {
    var result = (signed(context) ? "i" : "u") + size(context);
    if (bigendian(context)) result = result.toUpperCase();
    switch (base(context)) {
    case 0:   result += "n";  break;
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
    else if (base(context) === 0)
      context.result = null;
    return context.result;
  };
}


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
    if (["at", "select"].indexOf(this.key) >= 0) {
      return this.underlying.toString(context) + "." + this.key + "(" + 
             this.value.toString(context) + ")";
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
    if (this.key === "at") {
      context.bitten = this.value.value(context);
      context.adjusted = true;
      return this.underlying.deconstruct(context);
    }

    if (this.key === "select") {
      var result = this.underlying.deconstruct(context);
      context.scope.unshift(result);
      context.scope.unshift({this:result});
      result = this.value.value(context);
      context.scope.shift();
      context.scope.shift();
      return result;
    }

    if (this.key === "check") {
      var result = this.underlying.deconstruct(context);
      context.scope.unshift(result);
      context.scope.unshift({this:result});
      var check = this.value.value(context);
      context.scope.shift();
      context.scope.shift();
      if (!check)
        throw new DeconError("Failed check: " + inspect(result) +
                             " <> " + this.value.toString(context));
      return result;
    }      

    if (this.key === "if") {
      if (this.value.value(context)) 
        return this.underlying.deconstruct(context);
      else
        return undefined;
    }      

    if (this.key === "deconstruct") {
      // TODO: no one even asked for this feature
      var c2 = new Context(new Buffer(this.value.value(context)));
      return this.underlying.deconstruct(c2);
    }

    if (this.key === "load") { 
      // TODO: don't know about this feature. Kind of breaks the model.
      var filename = this.value.value(context);
      return this.underlying.deconstructFile(filename);
    }

    if (this.key === "cast") {
      debugger;
      var c2 = new Context(new Buffer(this.underlying.deconstruct(context)));
      return this.value.type(context).deconstruct(c2);
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
        var value = field.type.deconstruct(context);
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


function CheckedType(check, underlying) {

  this.toString = function (context) {
    return underlying.toString(context) + " " + check.toString(context);
  }

  this.deconstruct = function (context) {
    var result = underlying.deconstruct(context);
    if (!equal(check.value(context), result)){
      throw new DeconError("Non-matching value. Expected: " + 
                           inspect(check.value(context)) + ", got:" + 
                           inspect(result), context);
    }
    return result;
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
      if (!isnull(context.scope[s]) && !isnull(context.scope[s][name]))
        return makeValue(context.scope[s][name]);
    var result = CONSTANTS[name];
    if (isnull(result) && name == "position")
      result = makeValue(context.bitten);
    if (isnull(result))
      throw new DeconError("Undefined constant <" + name + ">", context);
    return result;
  }
}


function MapValue(keys, values) {
  this.value = function (context) {
    var result = {};
    for (var i = 0; i < keys.length; ++i)
      result[keys[i].value(context)] = values[i].value(context);
    return result;
  }

  this.type = function (context) {
    return new ReferenceType("null");  // TODO, I suppose?
  }

  this.toString = function (context) {
    var result = "{";
    for (var i = 0; i < keys.length; ++i) {
      if (i > 0) result += ", ";
      result += keys[i].toString(context) + ":" + values[i].toString(context);
    }
    return result + "}";
  }
}


function ArrayValue(values) {
  this.value = function (context) {
    var result = [];
    for (var i = 0; i < values.length; ++i)
      result.push(values[i].value(context));
    return result;
  }

  this.type = function (context) {
    return new ArrayType(new ReferenceType("null"));  // TODO, I suppose?
  }

  this.toString = function (context) {
    var result = "[" + values.length + ":";
    for (var i = 0; i < values.length; ++i) {
      if (i > 0) result += ", ";
      result += values[i].toString(context);
    }
    return result + "]";
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
    } else if (operator === "(") {
      // Function call
      var args = [];
      for (var i = 0; i < right.length; ++i)
        args[i] = right[i].value(context);
      result = result.apply(context.result, args);
    } else {
      // Arithmetic
      var rvalue = right.value(context);
      // TODO: auto type conversion?
      switch (operator) {
      case "+":  result += rvalue;  break;
      case "-":  result -= rvalue;  break;
      case "*":  result *= rvalue;  break;
      case "/":  result /= rvalue;  break;
      case "&":  result &= rvalue;  break;
      case "|":  result |= rvalue;  break;
      case "=":  result = equal(result, rvalue);  break;
      case ">":  result = (result > rvalue);  break;
      case "<":  result = (result < rvalue);  break;
      case "<<": result <<= rvalue;  break;
      case ">>": result >>= rvalue;  break;
      default: throw new DeconError("Internal Error: unknown operator " + 
                                    operator, context);
      }
    }
    return result;
  }

  this.type = function (context) {
    return new ReferenceType("null");  // frankly, this would be a mess.
  }

  this.toString = function (context) {
    if (operator === "[")
      return left.toString(context) + "[" + right.toString(context) + "]";
    else if (operator === "(")
      return left.toString(context) + "(...)";// + right.toString(context) + ")";
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
  else if (typeof value == typeof 1) {
    if (value < 0x80)
      return new LiteralValue(value, new ReferenceType("int8"));
    else if (value < 0x8000)
      return new LiteralValue(value, new ReferenceType("int16"));
    else if (value < 0x80000000)
      return new LiteralValue(value, new ReferenceType("int32"));
    else 
      return new LiteralValue(value, new ReferenceType("int64"));
  } else  {
    //throw new Error("Internal Error: Invalid parameter to makeValue: " + typeof value);
    return new LiteralValue(value, new ReferenceType("object"));
  }
}


function modref(attr, val, ref) {
  return new ModifiedType(attr, makeValue(val), new ReferenceType(ref));
}

var TYPES = {
  null: new AtomicType({base: 0, size: 0}),
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

  cstring: new ArrayType(new ReferenceType("char"))
}
TYPES["cstring"].until = makeValue(0);

var CONSTANTS = {
  null:  makeValue(null),
  false: makeValue(false),
  true:  makeValue(true)
};

var GLOBALS = {
};

if (require.main === module) {
  main();
}
