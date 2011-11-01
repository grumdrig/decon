#!/usr/bin/env node
// TODO: change some parseValue's to parseExpression?
// TODO: get rid of "base"?
// TODO: bigint. see https://github.com/substack/node-bigint
//                or https://github.com/dankogai/js-math-bigint
// TODO: get rid of "check", use "czech" formula if needed

var fs = require("fs");
var inspect = require("util").inspect;
var decon = require("./decon");

// Syntax error during .con file parsing
function SyntaxError(problem) {
  this.problem = problem;

  var err = new Error;
  err.name = 'Trace';
  err.message = '';
  Error.captureStackTrace(err, arguments.callee);
  this.stack = err.stack;
}

function isnull(x) {
  return (x === null || x === undefined || 
          typeof x === 'undefined' || typeof x === 'null');
}


function testParseValue(input, expected) {
  var d = parse(input, "value");

  /*
  if (!p.is(T.EOF)) {
    console.error("Numeric test parse dangling stuff for '" + input + "'");
    process.exit(-8);
  }
  */

  var ctx = new decon.Context();
  if (!decon.equal(ctx.evaluate(d), expected)) {
    console.error("FAILED TEST: Unexpected value " +// d.toString(context) + 
                  " expected " + 
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

  testParseValue("0", 0);
  testParseValue("0.5", 0.5);
  testParseValue("6", 6);
  testParseValue("3", 3);
  testParseValue("(2*3)", 2*3);
  testParseValue("(3*2)", 3*2);
  testParseValue("(-2*3/26)", -2*3/26);
  testParseValue("0x20", 32);
  testParseValue("\"a\"", "a");
  testParseValue(" \"\r\n\" ", "\r\n");
  testParseValue("' '", 32);
  testParseValue("'d'", 100);
  testParseValue("'c'", 99);
  testParseValue("'abcd'", (97 << 24) + (98 << 16) + (99 << 8) + 100);
  testParseValue("'\x45'", 0x45);
  testParseValue("'\xee'", 0xee);
  testParseValue("'\x00\x00\xaa\xee'", (0xaa << 8) + 0xee);
  testParseValue("'\x00\x00\x80\x3f'", (0x80 << 8) + 0x3f);

  return true;
}


var tok = require("./tokenizer");
var T = tok.T;

function DeconParser(text) {

  var stream = tok.lex(text);

  var pos = 0;

  function token() { return stream[pos].text; }
  
  function advance() { ++pos; }

  this.lineno = function () { 
    return (pos < stream.length) ? stream[pos].line : "EOF"; 
  }

  this.errorContext = function () {
    if (pos >= stream.length) return "EOF";
    return T[stream[pos].type] + ": '" + token() + "'";
  }

  var is = this.is = function (tokenTypeOrLiteral) { 
    if (pos >= stream.length) return;
    if (typeof tokenTypeOrLiteral === typeof "") {
      return token() === tokenTypeOrLiteral;
    } else if (stream[pos].type === tokenTypeOrLiteral) {
      return token() || true;
    }
  }

  function take(something) {
    if (pos >= stream.length) 
      throw new SyntaxError("Expected " + (T[something] || "something") + 
                            " at end of file");
    if (isnull(something)) {
      var result = token();
      advance();
      return result;
    } else if (typeof something === typeof "") {
      var literal = something;
      if (!is(literal))
        throw new SyntaxError("Expected literal '" + literal + "'");
      return take();
    } else {
      if (stream[pos].type !== something)
        throw new SyntaxError("Expected " + T[something]);
      var result = token();
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

      } else if (is(T.SCRIPT)) {
        var script = token();
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
      var m = take(T.IDENTIFIER);
      var v = parseValue();
      return parseType()[m](v);
    } else if (!isnull(UNARYMODS[is(T.IDENTIFIER)])) {
      var m = UNARYMODS[take(T.IDENTIFIER)];
      return parseType()[m[0]](makeValue(m[1]));
    } else if (tryToTake("cast")) {
      take("(");
      var to = parseType();
      take(")");
      return parseType().cast(to);
    } 

    if (tryToTake("union")) {
      // Union
      take("{");
      var union = [];
      for (maybeTakeNewlines(); !tryToTake("}"); ) {
        var type = tryToParseType();
        if (isnull(type)) {
          var value = tryToParseValue();
          if (isnull(value)) 
            throw new SyntaxError("Type (or value) expected");
          type = decon.literal(value, value.type);
        }
        union.push(type);
        if (tryToTake("}")) break;  // Allow closing brace w/o newline
        takeNewlines();
      }
      var result = decon.union(union);

    } else if (tryToTake("{")) {
      // Struct
      var struct = {};
      var f = 0;
      for (maybeTakeNewlines(); !tryToTake("}"); ) {
        f++;
        var fieldnames = ["____" + f];
        if (is(T.IDENTIFIER)) {
          var mark = pos;
          var fieldnames = [take(T.IDENTIFIER)];
          while (tryToTake(",") && is(T.IDENTIFIER))
            fieldnames.push(take(T.IDENTIFIER));
          if (!tryToTake(":")) {
            pos = mark;
            fieldnames = ["____" + f];
          }
        }

        var fieldtype = tryToParseType();
        if (isnull(fieldtype)) {
          var fieldvalue = tryToParseValue(true);
          if (isnull(fieldvalue)) 
            throw new SyntaxError("Field type (or value) expected");
          fieldtype = decon.literal(fieldvalue, fieldvalue.type);
        }

        fieldnames.each(function (i,fieldname) {
            struct[fieldname] = fieldtype;
          });

          
        if (tryToTake("}")) break;  // Allow closing brace w/o newline
        takeNewlines();
      }
      var result = decon.struct(struct);

    } else if (is(T.IDENTIFIER)) {
      // Reference named type
      var result = decon.ref(take(T.IDENTIFIER));

    } else {
      return;
    }

    for (;;) {
      if (tryToTake(".")) {
        if (MODIFIERS.indexOf(is(T.IDENTIFIER)) >= 0) {
          result = result[take(T.IDENTIFIER)](parseValue());
        } else if (tryToTake("cast")) {
          take("(");
          var to = parseType();
          take(")");
          result = result.cast(to);
        } else {
          var mname = take(T.IDENTIFIER);
          var m = UNARYMODS[mname];
          if (isnull(m))
            throw new SyntaxError("Invalid type modifier: " + mname);
          result = result[m[0]](makeValue(m[1]));
        }
      } else if (tryToTake("[")) {
        var limit = {};
        for (;;) {
          if (isnull(limit.until) && tryToTake("until")) {
            limit.until = parseValue();
          } else if (isnull(limit.through) && tryToTake("through")) {
            limit.through = parseValue();
          } else if (isnull(limit.before) && tryToTake("before")) {
            limit.before = parseValue();
          } else if (isnull(limit.index) && tryToTake("index")) {
            limit.index = take(T.IDENTIFIER);
          } else {
            if (!isnull(limit.length)) 
              break;
            limit.length = tryToParseExpression();
            if (isnull(limit.length))
              break;
          }
        }
        take("]");
        result = result.array(limit);
      } else {
        break;
      }
    }

    var check = tryToParseValue(true);
    if (!isnull(check)) 
      result = result.equals(check);

    return result;
  }
                             

  var parseValue = this.parseValue = function (infield) {
    var r = tryToParseValue(infield);
    if (isnull(r))
      throw new SyntaxError("Value expected");
    return r;
  }

  function tryToParseValue(infield) {

    if (is(T.INTEGER)) {
      return makeValue(parseInt(take()));

    } else if (is(T.REAL)) {
      return makeValue(parseFloat(take()));

    } else if (is(T.HEXNUMBER)) {
      var hex = take(T.HEXNUMBER);
      return makeValue(parseInt(hex, 16), 
                       decon.ref("byte").size(makeValue(4 * hex.length)));
                                               

    } else if (is(T.SINGLEQUOTED)) {
      // TODO: deal with endianness and type-specifying and all that
      var s = evalString(take(T.SINGLEQUOTED));
      var value = 0;
      for (var i = 0; i < s.length; ++i)
        value = (value << 8) + (0xFF & s.charCodeAt(i));
      return makeValue(value, decon.ref("byte").size(makeValue(8 * s.length)));
                                                     

    } else if (is(T.QUOTED)) {
      var value = evalString(take(T.QUOTED));
      return makeValue(value, decon.ref("char").array({length:
                                                    makeValue(value.length)}));

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
      var mapValue = function (ctx) {
        var result = {};
        for (var i = 0; i < keys.length; ++i)
          result[keys[i].value(context)] = values[i].value(context);
        return result;
      }
      //mapValue.type = "TODO?";
      return mapValue;

    } else if (tryToTake("[")) {
      var values = [];
      if (!tryToTake("]")) for (;; take(",")) {
        values.push(parseExpression());
        if (tryToTake("]")) break;
      }
      var result = function (ctx) {
        var result = [];
        for (var i = 0; i < values.length; ++i)
          result.push(ctx.evaluate(values[i]));
        return result;
      };
      //result.type = something?
      return result;

    } else if (!infield && is(T.IDENTIFIER)) {
      var id = take(T.IDENTIFIER);
      var result = function (s) { return s[id]; };
      // result.type = something?
      return result;

    } else if (tryToTake("(")) {
      var result = parseExpression();
      take(")");
      return result;

    } else {
      return null;
    }
  }


  var operators = "*/+-.[=<>&|(".split("").concat([">>", "<<"]);

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
    if (!isnull(result)) while(operators.indexOf(token()) >= 0) {
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
      result = expressionValue(result, operator, rhs);
    }

    if (tryToTake("as"))
      result.type = parseType();

    return result;
  }

}


String.prototype.endsWith = function (suffix) {
  return this.indexOf(suffix, this.length - suffix.length) !== -1;
};


Array.prototype.each = function (callback) {
  for (var i = 0; i < this.length; ++i) 
    callback(i, this[i]);
}


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

  var tree = Main.parseFile(infile, partialok);

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
};


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
    return decon.ref("null");  // TODO, I suppose?
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
    return decon.ref("null").array();  // TODO, I suppose?
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


function expressionValue(left, operator, right) {
  if (operator === ".") {
    // Field access
    return function (ctx) { return ctx.evaluate(left)[right]; };
  } else if (operator === "[") {
    // Index
    return function (ctx) { return ctx.evaluate(left)[ctx.evaluate(right)]; };
  } else if (operator === "(") {
    // Function call
    return function (ctx) {
      var args = [];
      for (var i = 0; i < right.length; ++i)
        args[i] = ctx.evaluate(right[i]);
      return ctx.evaluate(left).apply(ctx.result, args);
    };
  } else {
    // Arithmetic
    switch (operator) {
    case "+":  return function (s) { return s.eval(left) + s.eval(right); };
    case "-":  return function (s) { return s.eval(left) - s.eval(right); };
    case "*":  return function (s) { return s.eval(left) * s.eval(right); };
    case "/":  return function (s) { return s.eval(left) / s.eval(right); };
    case "&":  return function (s) { return s.eval(left) & s.eval(right); };
    case "|":  return function (s) { return s.eval(left) | s.eval(right); };
    case "=":  return function (s) { return s.eval(left) === s.eval(right); };
    case ">":  return function (s) { return s.eval(left) > s.eval(right); };
    case "<":  return function (s) { return s.eval(left) < s.eval(right); };
    case ">>": return function (s) { return s.eval(left) >> s.eval(right); };
    case "<<": return function (s) { return s.eval(left) << s.eval(right); };
    default: throw new Error("Internal Error: unknown operator " + operator);
    }
  }
}


function makeValue(value, optType) {
  var result = function () { return value; };
  result.type = optType || decon.typeForValue(value);
  return result;
}


function modref(attr, val, ref) {
  return decon.ref(ref)[attr](makeValue(val));
}


var TYPES = decon.TYPES;

var CONSTANTS = {
  null:  makeValue(null),
  false: makeValue(false),
  true:  makeValue(true)
};

var GLOBALS = {
};

if (require.main === module)
  main();
