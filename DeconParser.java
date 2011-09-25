import java.util.regex.Pattern;
import java.util.regex.Matcher;
import java.io.*;
import java.util.*;

// TODO: get rid of case-significance for types vs fields, etc
// TODO: constants
// TODO: probably want a string type
// TODO: use a context for dereferencing

// Syntax error during .con file parsing
class ParseError extends Exception {
  final String problem;
  ParseError(String p) { problem = p; }
}

// Syntax error during deconstruction phase
class DeconError extends Exception {
  final String problem;
  DeconError(String p) { problem = p; }
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
     +  "|([_a-z][-\\w]*)"       // 5.   lcid
     +  "|([A-Z][-\\w]*)"        // 6.   ucid
     +  "|0[xX](\\p{XDigit}+)"   // 7.   hex constant
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
  private static final int T_HEXNUMBER  = 7;
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
        System.err.println("Matching " + input + " to token type " + 
                           expected[i].toString());
        System.err.println("Unexpected token '" + m.group() + "'");
        System.exit(-3);
      }
    }
  }

  public static void testParseNumeric(String input, int expected) {
    DeconParser p = null;
    Integer d = null;
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
    testMatch("0x0", new Integer[] { T_HEXNUMBER });
    testMatch("0XABC", new Integer[] { T_HEXNUMBER });

    testParseNumeric("6", 6);
    testParseNumeric("3", 3);
    testParseNumeric("2*3", 2*3);
    testParseNumeric("3*2", 3*2);
    testParseNumeric("-2*3/26", -2*3/26);
    testParseNumeric("0x20", 32);
    
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
      e.printStackTrace(System.err);
      System.exit(-1);
    }
  }


  public static HashMap<String,Type> types = new HashMap<String,Type>();
  // One predefined type
  { types.put("Int", new NumericType(true, 32, false, 10)); } 

  private void takeNewlines() throws ParseError {
    take(T_NEWLINE); 
    maybeTakeNewlines();
  }

  private void maybeTakeNewlines() throws ParseError {
    while (is(T_NEWLINE)) advance();
  }

  private void go() throws ParseError {
    maybeTakeNewlines();
    while (!is(T_EOF)) {
      
      if (tryToTake("import")) {
        // import
        String filename = take(T_QUOTED);
        parseFile(filename);
      } else {
        // Type def
        String name = take(T_UCID);
        take("=");
        Type type = parseType();
        types.put(name, type);
      }
      
      if (!is(T_EOF)) takeNewlines();
    }
  }

  static void debug(String s) {
    System.err.println(s);
  }

  private Type parseType() throws ParseError {
    Type result = null;
    if (tryToTake("{")) {
      // Struct
      StructType s = new StructType();
      for (maybeTakeNewlines(); !tryToTake("}"); ) {
        String fieldname = take(T_LCID);
        Type fieldtype = parseType();
        s.addField(fieldname, fieldtype);
        takeNewlines();
      }
      result = s;
    } else {
      // Reference named type
      result = new ReferenceType(take(T_UCID));
    }

    while (tryToTake(".")) {
      // TODO: hold the reference so that the underlying type can be changed to
      // affect all descendants (endianness is what I'm thinking about here,
      // but that also allows forward references)
      result = dereferenceType(result);
      if (!(result instanceof NumericType))
        throw new ParseError("Numeric type expected");
      NumericType nt = new NumericType((NumericType) result);
      String modifier = take(T_LCID);
      if (modifier.equals("signed")) {
        nt.signed = true;
      } else if (modifier.equals("unsigned")) {
        nt.signed = false;
      } else if (modifier.equals("size")) {
        nt.size = parseNumeric();
      } else if (modifier.equals("bigendian")) {
        nt.bigendian = true;
      } else if (modifier.equals("littleendian")) {
        nt.bigendian = false;
      } else if (modifier.equals("base")) {
        nt.base = parseNumeric();
      } else if (modifier.equals("ascii")) {
        nt.base = 256;
      } else {
        throw new ParseError("Unknown type modifier");
      }
      result = nt;
    }
        
    while (tryToTake("[")) {
      ArrayType at = new ArrayType(result);
      result = at;
      if (tryToTake("until")) {
        at.until = parseNumeric();
      } else if (tryToTake("before")) {
        at.before = parseNumeric();
      } else {
        at.length = tryToParseNumeric();
      }
      take("]");
    }
    return result;
  }
                             

  static Type dereferenceType(Type t) throws ParseError {
    for (; t instanceof ReferenceType;) {
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
    Integer result = null;
    if (is(T_NUMBER)) {
      result = Integer.parseInt(take());
    } else if (is(T_HEXNUMBER)) {
      result = Integer.parseInt(take(T_HEXNUMBER), 16);
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
      String arg = args[a];
      if (arg.endsWith(".con")) {
        parseFile(arg);
      } else {
        // Must be a type
        main = types.get(arg);
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
        ++a;
        break;
      }
    }
    InputStream in = System.in;
    PrintStream out = System.out;
    if (a < args.length) {
      try {
        in = new BufferedInputStream(new FileInputStream(args[a++]));
      } catch(FileNotFoundException e) {
        System.err.printf("Input file not found: " + args[a-1]);
        System.exit(404);
      }
    }
    /*
    if (a < args.length) {
      out = new PrintWriter(new FileWriter(args[a++]));
    }
    */
    if (a < args.length)
      usage();

    for (String k : types.keySet())
      System.err.print(k + ": " + types.get(k) + "\n");

    System.err.println(main);

    Context context = new Context(in, out);
    try {
      main.deconstruct(context);
    } catch (DeconError e) {
      // TODO print some more context
      System.err.println("DECONSTRUCTION ERROR @ " + context.bitten + ": " +
                         e.problem);
      e.printStackTrace(System.err);
      System.exit(-2);
    }
  }

  static void usage() {
    System.err.println("Usage: java DeconParser [DEF.con...] MAIN [IN [OUT]]");
    System.exit(302);
  }
}

/*
class SwitchableOutputStream extends OutputStream {
  boolean on = true;
  final OutputStream sink;
  SwitchableOutputStream(OutputStream sink) {  this.sink = sink;  }
  public void close() {  sink.close();  }
  public void flush() {  sink.flush();  }
  public void write(byte[] b) {  if (on) sink.write(b);  }
  public void write(byte[] b, int off, int len) { if (on) sink.write(b,off,len);}
  public void write(int b) {  if (on) sink.write(b);  }
  }*/


class Context {
  private final InputStream in;
  private PrintStream out;

  int bitten = 0;
  int bit = 0;
  Integer buffer = null;  // very small buffer!

  Integer value = 0;


  Context(InputStream in, PrintStream out) {
    this.in = in;
    this.out = out;
  }

  private Context(Context prototype) {
    this.in = prototype.in;
    this.out = prototype.out;
    this.bitten = prototype.bitten;
    this.bit = prototype.bit;
    this.buffer = prototype.buffer;
    this.value = prototype.value;
  }

  void print(String value) {
    if (out != null) out.print(value);
  }

  void println(String value) {
    if (out != null) out.println(value);
  }

  void printf(String format, Object... args) {
    if (out != null) out.printf(format, args);
  }

  Context silent() {
    Context result = new Context(this);
    result.out = null;
    return result;
  }
  
  int bite() throws DeconError {
    if (buffer != null) {
      int result = buffer;
      buffer = null;
      ++bitten;
      return result;
    }

    try {
      bit = in.read();
    } catch (IOException e) {
      throw new DeconError("Input error");
    }
    if (bit == -1)
      throw new DeconError("EOF");
    ++bitten;
    return bit;
  }


  int peek() throws DeconError {
    if (eof()) return -1;  // fills the buffer
    return buffer;
  }
    

  boolean eof() throws DeconError {
    if (buffer != null) return false;
    try {
      buffer = in.read();
    } catch (IOException e) {
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



abstract class Type {
  Type dereference() { return this; }
  abstract public void deconstruct(Context context) throws DeconError;
}



class ReferenceType extends Type {
  String name;
  
  ReferenceType(String name) {
    this.name = name;
  }

  Type dereference() {
    Type result = DeconParser.types.get(name);
    if (result != null) result = result.dereference();
    return result;
  }

  public String toString() {
    Type t = dereference();
    if (t == null)
      return name + ":???";
    else
      return t.toString();
  }

  public void deconstruct(Context context) throws DeconError {
    Type t = DeconParser.types.get(name);
    if (t == null)
      throw new DeconError("Undefined type " + name);
    t.deconstruct(context);
  }
}



class ArrayType extends Type {
  Type element;
  Integer length = null;
  Integer until = null;
  Integer before = null;
  
  ArrayType(Type element) {
    this.element = element;
  }

  public String toString() {
    return "" + element + "[" + 
      (until != null ? "until " + until : "") + 
      (length != null ? length : "") + 
      "]";
  }

  public void deconstruct(Context context) throws DeconError {
    context.value = null;
    Type e = element.dereference();
    boolean isstr = 
      (e instanceof NumericType) &&
      ((NumericType)e).base == 256;
    context.print(isstr ? "\"" : "[");
    for (int i = 0; ; ++i) {
      if (length != null && i >= length) break;
      if (until != null && context.value == until) break;
      if (before != null && context.peek() == before) break;
      if (length == null && until == null && before == null && context.eof()) 
        break;
      if (!isstr && i > 0) context.print(", ");
      e.deconstruct(context);
    }
    context.print(isstr ? "\"" : "]");
  }
}


class NumericType extends Type {
  boolean signed;
  int size;
  boolean bigendian;
  int base;

  NumericType(boolean signed, int size, boolean bigendian, int base) {
    this.signed = signed;
    this.size = size;
    this.bigendian = bigendian;
    this.base = base;
  }

  NumericType(NumericType that) {
    this(that.signed, that.size, that.bigendian, that.base);
    this.signed = that.signed;
    this.size = that.size;
    this.bigendian = that.bigendian;
    this.base = that.base;
  }

  public String toString() {
    String result = (signed ? "u" : "i") + size;
    if (bigendian) result = result.toUpperCase();
    if (base != 10) ;result += "%" + base;
    return result;
  }

  public void deconstruct(Context context) throws DeconError {
    context.value = 0;
    for (int i = 0; i < size; i += 8) {
      int v = context.bite();
      if (bigendian) {
        if (signed && i == 0) v = (byte)v;
        context.value <<= 8;
        context.value += v;
      } else {
        if (signed && i == size - 8) v = (byte)v;
        context.value |= v << i;
      }
    }
    if (base == 256) {
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
      context.print(Integer.toString(context.value, base));
    }
  }
}


class StructType extends Type {

  class Field {
    String name;
    Type type;

    Field(String name, Type type) {
      this.name = name;
      this.type = type;
    }

    public String toString() {
      return name + " " + type;
    }
  }
  
  List<Field> fields = new LinkedList<Field>();

  void addField(String name, Type type) {
    fields.add(new Field(name, type));
  }

  public String toString() {
    String result = "{\n";
    for (Field field : fields) result += field + "\n";
    return result + "}";
  }


  public void deconstruct(Context context) throws DeconError {
    context.println("{");
    int i = 0;
    for (Field field : fields) {
      if (field.name == null || field.name.startsWith("_")) {
        field.type.deconstruct(context.silent());
      } else {
        if (i++ > 0)
          context.println(",");
        context.print("\"" + field.name + "\":");
        field.type.deconstruct(context);
      }
    }
    context.println("}");
  }
}

