// TODO: bigint. see https://github.com/substack/node-bigint
//                or https://github.com/dankogai/js-math-bigint


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
fpRegex = "-?\\d+\\.\\d+(?:[eE][+-]?\\d+)?|" +
          "-?\\d+[eE][+-]?\\d+";

var intRegex = "[+-]?[0-9]+";
//var punctRegex = "[-!#$%&()\\*\\+,\\./:;<=>?@\\[\\\\]^_`{|}~]";
var punctRegex = "[\\.{}\\[\\]()]";
                

function TokenMatcher(input) {
  this.input = input;
  
  this.re = new RegExp("^"                         // beginning at last match:
                       +"([ \t]*(?:#.*)?)"         // + spaces/comments before
                       +"("                        // + any token: (
                       +  "([\\r\\n;])"            // +   \n
                           +  "|<script>((?:x|[^x])*?)</script>"// +   <script> escape
                       +  '|"((?:[^"\\\\]|\\\\.)*)"'//+   quoted
                       +  "|'((?:[^'\\\\]|\\\\.)*)'"//+   single-quoted
                       +  "|([_a-zA-Z]\\w*)"       // +   identifier
                       +  "|("+fpRegex+")"         // +   floating point const
                       +  "|0[xX]([0-9a-fA-F]+)"   // +   hex constant
                       +  "|("+intRegex+")"        // +   integer constant
                       +  "|([-*/+=:<>&|]+)"       // +  operators
                       +  "|("+punctRegex+")"      // +  punctuation
                       +  "|($)"                   // +  EOF
                       +  "|(.)"                   // +  illegal
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
  
  this.text = function () {
    return this.group(this.type());
  };

  this.type = function () { 
    for (var i = 3; i < this.match.length; ++i) if (this.group(i)) return i;
  };

  this.pos = 0;

  this.mark = function () { return [this.pos, this.match]; }
  this.reset = function (mark) { this.pos = mark[0]; this.match = mark[1]; }
}

// Token types
var T = exports.T = [
  'WHOLEMATCH',
  'WHITESPACE',
  'TOKEN',
  'NEWLINE',
  'SCRIPT',
  'QUOTED',
  'SINGLEQUOTED',
  'IDENTIFIER',
  'REAL',
  'HEXNUMBER',
  'INTEGER',
  'OPERATOR',
  'PUNCTUATION',
  'EOF',
  'ILLEGAL'
];

// Forward-lookup of token types
for (var i = 0; i < T.length; ++i)
  exports[T[i]] = T[T[i]] = i;


exports.lex = function (buffer) {
  var result = [];
  var line = 1;
  var linepos = 0;
  var matcher = new TokenMatcher(buffer);
  for (; matcher.pos < matcher.input.length;) {
    var p = matcher.pos;
    matcher.find();
    if (!matcher.match) {
      throw new Error("Tokenizer error at " + matcher.pos + ": " + inspect(matcher.input.substr(matcher.pos, 20)));
    }
    result.push({
      text: matcher.text(),
      type: matcher.type(),
      pos: p,
      line: line,
      col: p - linepos
    });
    if (matcher.group(T.NEWLINE) && matcher.group(T.NEWLINE) != ";") {
      line++;
      linepos = matcher.pos;
    }
    if (matcher.group(T.EOF)) break;
  }
  result.push({ text: '', type: T.EOF, pos: matcher.pos,
                line: linepos, col: matcher.pos - linepos });
  return result;
}

function main() {
  var args = process.argv.slice(2);
  var s = args[0];
  if (s === "-f") s = require("fs").readFileSync(args[1], 'utf8');
  var stream = exports.lex(s);
  for (var i = 0; i < stream.length; ++i)
    stream[i].type = T[stream[i].type];
  console.dir(stream);
  //console.dir(exports.lex(args[0]));
}
  

function testMatch(input, expected) {
  expected.push(T.EOF);
  var stream = exports.lex(input);
  function err(msg) {
    throw new Error("TEST FAILED matching " + input + " to " + 
                    require("util").inspect(expected) + ": " + msg);
  }
  if (stream.length != expected.length)
    err("Expected " + expected.length + " tokens, got " + 
        require("util").inspect(stream));
  for (var i = 0; i < expected.length; ++i)
    if (stream[i].type != expected[i])
      err("Expected " + expected[i] +
                      ", got " + require("util").inspect(stream[i]));
}


var assert = require("assert")

function runTests() {
  testMatch("lcid", [ T.IDENTIFIER ]);
  testMatch("UcId", [ T.IDENTIFIER ]);
  testMatch("6", [ T.INTEGER ]);
  testMatch("5.4", [ T.REAL ]);
  testMatch(".", [ T.PUNCTUATION ]);
  testMatch("\"la la la\"", [ T.QUOTED ]);
  testMatch("\n", [ T.NEWLINE ]);
  testMatch(";", [ T.NEWLINE ]);
  testMatch("0x0", [ T.HEXNUMBER ]);
  testMatch("0XABC", [ T.HEXNUMBER ]);
  testMatch("*", [ T.OPERATOR ]);
  testMatch("=", [ T.OPERATOR ]);
  testMatch("* =", [ T.OPERATOR, T.OPERATOR ]);
  testMatch(" {}", [ T.PUNCTUATION, T.PUNCTUATION ]);
  testMatch(" $$", [ T.ILLEGAL, T.ILLEGAL ]);
  testMatch("{key:value}", [T.PUNCTUATION, T.IDENTIFIER, T.OPERATOR, 
                            T.IDENTIFIER, T.PUNCTUATION]);
  testMatch("<script>\nfunction x(a,b) { return a+b; }\n</script>",[T.SCRIPT]);
  
  return true;
}

runTests();

if (require.main === module) {
  main();
}
