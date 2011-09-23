import java.util.regex.Pattern;
import java.util.regex.Matcher;
import java.io.*;
import java.util.Vector;
import java.util.Iterator;


class ParseError extends Exception {
  final String problem;
  ParseError(String p) { problem = p; }
}


class DeconParser {

  // From http://java.sun.com/javase/6/docs/api/java/lang/Double.html
  private static final String D = "(?:\\p{Digit}+)";
  private static final String H = "(?:\\p{XDigit}+)";
  private static final String E = "[eE][+-]?" + D;
  private static final String fpRegex =
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
  

  private static final Pattern tokenPattern = Pattern.compile
    ("\\G"                       //    beginning at last match:
     +"([ \t]*(?:#.*)?)"         // 1. spaces & comments before
     +"("                        // 2. any token: (
     +  "([\r\n])"               // 3.   \n
     +  "|\"(.*)\""              // 4.   quoted
     +  "|([a-z][-\\w]*)"        // 5.   lcid
     +  "|([A-Z][-\\w]*)"        // 6.   ucid
     +  "|("+fpRegex+")"         // 8.   numerical constant
     +  "|(\\p{Punct})"          // 9.   punctuation
     +  "|(\\z)"                 // 10.  EOF
     +")");                      //    )

  // TODO: make this an enum?
  private static final int T_WHITESPACE = 1;
  private static final int T_TOKEN      = 2;
  private static final int T_NEWLINE    = 3;
  private static final int T_QUOTED     = 4;
  private static final int T_LCID       = 5;
  private static final int T_UCID       = 6;
  private static final int T_NUMBER     = 8;
  private static final int T_PUNCTUATION= 9;
  private static final int T_EOF        = 10;

  public static void testMatch(String input, Integer[] expected) {
    Matcher m = tokenPattern.matcher(input);
    for (int i = 0; i < expected.length; ++i) {
      if (!m.find()) {
        System.err.println("Can't match");
        System.exit(-3);
      }
      if (m.group(expected[i]) == null) {
        for (int g = 0; g <= m.groupCount(); ++g)
          System.err.println("" + g + ": '" + m.group(g) + "'");
        System.err.println("Unexpected token '" + m.group() + "'");
        System.exit(-3);
      }
    }
  }

  public static void testParseNumeric(String input, double expected) {
    DeconParser p = null;
    Double d = null;
    try {
      p = new DeconParser(input);
      d = p.parseNumeric();
    } catch (ParseError e) {
      System.err.println("Numeric test parse error [" + e.problem + "] '" + input + "'");
      System.exit(-7);
    }
    if (!p.is(T_EOF)) {
      System.err.println("Numeric test parse dangling stuff for '" + input +"'");
      System.exit(-8);
    }
    if (Math.abs(d - expected) > 0.0001) {
      System.err.println("Unexpected numeric " + d + " expected " + expected + " for '" + input + "'");
      System.exit(-9);
    }
  }

  public static void runTests() {
    testMatch("\n", new Integer[] { T_NEWLINE });
    testMatch("\"la la la\"", new Integer[] { T_QUOTED });
    testMatch("lcid", new Integer[] { T_LCID });
    testMatch("UcId", new Integer[] { T_UCID });
    testMatch("6", new Integer[] { T_NUMBER });
    testMatch(".", new Integer[] { T_PUNCTUATION });

    testParseNumeric("6", 6);
    testParseNumeric("PI", Math.PI);
    testParseNumeric("2*PI", 2 * Math.PI);
    testParseNumeric("PI*2", 2 * Math.PI);
    testParseNumeric("-2*PI/26", -Math.PI/13);
    
    System.err.println("PASS");
  }

  
  
  private final Matcher tokenMatcher;

  private void advance() throws ParseError {
    if (!tokenMatcher.find()) {
      throw new ParseError("Unrecognised input");
    }
  }

  private boolean is(int t) { 
    return tokenMatcher.group(t) != null; 
  }

  private boolean is(String literal) { 
    return tokenMatcher.group(T_TOKEN).equals(literal);
  }

  private String take() throws ParseError {
    String result = tokenMatcher.group(T_TOKEN);
    advance();
    return result;
  }
  
  private String take(int tokenType) throws ParseError {
    String result = tokenMatcher.group(tokenType);
    if (result == null) {
      String what;
      switch (tokenType) {
      case T_WHITESPACE:
        what = "whitespace";
        break;
      case T_NEWLINE:
        what = "newline";
        break;        
      case T_QUOTED:
        what = "quoted string";
        break;
      case T_LCID:
        what = "identifier";
        break;
      case T_UCID:
        what = "Identifier";
        break;
      case T_NUMBER:
        what = "number";
        break;
      case T_PUNCTUATION:
        what = "punctuation";
        break;
      case T_EOF:
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

  private String take(String literal) throws ParseError {
    if (!is(literal))
      throw new ParseError("Expected literal '" + literal + "'");
    return take();
  }

  private boolean tryToTake(String literal) throws ParseError {
    if (!is(literal)) {
      return false;
    } else {
      advance();
      return true;
    }
  }


  public DeconParser(String text) throws ParseError {
    tokenMatcher = tokenPattern.matcher(text);
    if (!tokenMatcher.lookingAt()) 
      throw new ParseError("Syntax error at start of file");
  }

  public static String readFile(String filename) {
    try {
      final File file = new File(filename);
      final DataInputStream dis =
        new DataInputStream(new FileInputStream(file));
      final byte[] buffer = new byte[(int) file.length()];
      dis.readFully(buffer);
      dis.close();
      return new String(buffer, "UTF-8");
    } catch (IOException e) {
      System.err.println("Error reading file: '" + filename + "'");
      System.exit(1);
      return null;
    }
  }

  public static void parseFile(String filename) {
    final String program = readFile(filename);
    DeconParser p = null;
    try {
      p = new DeconParser(program);
      p.go();
    } catch (ParseError e) {
      // TODO add context
      final int lineno = program.substring(0, 
                  p.tokenMatcher.start()).replaceAll("[^\n]", "").length() + 1;
      System.err.println("SYNTAX ERROR [" + filename + ":" + 
                     lineno + "]: " + 
                     e.problem + " at '" + p.tokenMatcher.group(T_TOKEN) + "'");
      System.exit(-1);
    }
  }


  static HashMap<String,Type> types = new HashMap<String,Type>();
  { types.put("Int", new NumericType()); } // One predefined type

  private void takeNewlines() throws ParseError {
    for (take(T_NEWLINE); is(T_NEWLINE); take(T_NEWLINE)) { }
  }


  private void go() throws ParseError {
    while (is(T_NEWLINE)) 
      advance();
    while (!is(T_EOF)) {
      if (tryToTake("import")) {
        // import
        String filename = take(T_QUOTED);
        parseFile(filename);
        takeNewlines();
        
      } else {
        // Type def
        String name = take(T_UCID);
        if (topType == null) topType = name;
        take("=");
        Type type = parseType();

        if (!is(T_EOF)) takeNewlines();
      }
    }
    return topType;
  }

  private Type parseType() throws ParseError {
    Type result = null;
    if (tryToTake("{")) {
      // Struct
      Struct s = new Struct();
      for (;;) {
        if (tryToTake("}"))
          break;
        String fieldname = take(T_LCID);
        Type fieldtype = parseType();
        s.addField(fieldname, fieldtype);
      }
      result = s;
    } else {
      // Reference named type
      result = new TypeReference(take(T_UCID));
    }

    while (tryToTake(".")) {
      result = dereference(result);
      NumericType nt = (NumericType) result;
      if (nt == null) 
        throw new ParseError("Numeric type expected");
      String modifier = take(T_LCID);
      if (modifier == "signed") {
        nt.signed = true;
      } else if (modifier == "unsigned") {
        nt.signed = false;
      } else if (modifier == "size") {
        nt.size = parseInteger();
      } else if (modifier == "base") {
        nt.base = parseInteger();
      } else if (modifier == "ascii") {
        nt.display = NumericType.ASCII;
      } else if (modifier == "integer") {
        nt.display = NumericType.INTEGER;
      } else {
        throw new ParseError("Unknown type modifier");
      }
    }
        
    while (tryToTake("[")) {
      ArrayType at = new ArrayType(result);
      result = at;
      if (tryToTake("until")) {
        at.until = parseInteger();
      } else {
        at.length = parseInteger();
      }
      take("]");
    }
  }
                             

  Type deferenceType(Type t) throws ParseError {
    for (;;) {
      ReferenceType rt = (ReferenceType) t;
      if (rt == null) break;
      t = types.get(rt.name);
      if (t == null)
        throw new ParseError("Unknown type " + rt.name);
    }
    return t;
  }     

  private int parseNumeric() throws ParseError {
    Integer r = tryToParseNumeric();
    if (r == null)
      throw new ParseError("Numeric value expected");
    return r;
  }

  private Integer tryToParseNumeric() throws ParseError {
    Double result = null;
    if (is(T_NUMBER)) {
      result = Integer.parseInteger(take());
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

  public static void main(String args[]) {
    runTests();

    Type main = null;
    int a = 0;
    for (; a < args.length; ++a) {
      if (arg.endsWith(".con")) {
        parseFile(arg);
      } else {
        // Must be a type
        Type main = types.get(arg);
        if (main == null) {
          // Don't know it - look for a .con file
          if ((new File(arg + ".con")).exists())
            parseFile(arg + ".con");
          main = types.get(arg);
        }
        if (main == null) {
          System.err.println("Construction not found: " + arg);
          System.exit(404);
        }
      }
    }
    InputStream infile = System.in;
    PrintStream outfile = System.out;
    if (a < args.length) 
      infile = new BufferedInputStream(new FileInputStream(args[a++]));
    if (a < args.length) 
      outfile = new BufferedOutputStream(new FileOutputStream(args[a++]));
    if (a < args.length)
      usage();

    main.deconstruct(new DataInputStream(infile), outfile);
  }
}


abstract class Type {
  abstract public void deconstruct(DataInputStream input, PrintStream output);
}