import java.util.regex.Pattern;
import java.util.regex.Matcher;
import java.io.IOException;
import java.io.DataInputStream;
import java.io.FileInputStream;
import java.io.File;
import java.util.Vector;
import java.util.Iterator;


class ParseError extends Exception {
  final String problem;
  ParseError(String p) { problem = p; }
}


class TonedefParser {

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
     +  "|(\\d+@\\d+)"           // 7.   loc'n
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
  private static final int T_LOCATION   = 7;
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
    TonedefParser p = null;
    Double d = null;
    try {
      p = new TonedefParser(input);
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
    testMatch("6@7", new Integer[] { T_LOCATION });

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
      case T_LOCATION:
        what = "x@y location";
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


  public TonedefParser(String text) throws ParseError {
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
    TonedefParser p = null;
    try {
      p = new TonedefParser(program);
      p.go();
    } catch (ParseError e) {
      // TODO add context
      final int lineno = program.substring(0, p.tokenMatcher.start()).replaceAll("[^\n]", "").length() + 1;
      System.err.println("SYNTAX ERROR [" + filename + ":" + 
                         lineno + "]: " + 
                         e.problem + " at '" + p.tokenMatcher.group(T_TOKEN) + "'");
      System.exit(-1);
    }
  }

  private void go() throws ParseError {
    while (is(T_NEWLINE)) 
      advance();
    while (!is(T_EOF)) {
      if (tryToTake("import")) {
        // import
        String filename = take(T_QUOTED);
        parseFile(filename);
        for (take(T_NEWLINE); is(T_NEWLINE); take(T_NEWLINE)) { }
        
      } else {
        // Native or assembly def
        String group = is(T_LCID) ? take() : null;
        AssemblyDef def = new AssemblyDef(take(T_UCID));
        def.group = group;
        if (tryToTake("native")) {
          // Native def
          def.nativeClass = is(T_UCID) ? take() : def.name;
          take(":");
          for (take(T_NEWLINE); is(T_NEWLINE); take(T_NEWLINE)) { }
          if (is(T_QUOTED)) {
            def.docstring = take(T_QUOTED);
            // TODO: should allow: "thing" > port Part
            for (take(T_NEWLINE); is(T_NEWLINE); take(T_NEWLINE)) { }
          }
          while (true) {
            def.nativePort(take(T_LCID));
            if (!tryToTake(",")) {
              for (take(T_NEWLINE); is(T_NEWLINE); take(T_NEWLINE)) { }
              if (tokenMatcher.group(T_WHITESPACE).length() == 0)
                break;
            }
          }
          
        } else {
          // Assembly def
          take(":");
          for (take(T_NEWLINE); is(T_NEWLINE); take(T_NEWLINE)) { }
          if (is(T_QUOTED)) {
            def.docstring = take(T_QUOTED);
            for (take(T_NEWLINE); is(T_NEWLINE); take(T_NEWLINE)) { }
          }
          while (true) { // Loop over chains
            // Parse a chain

            Double initializer = tryToParseNumeric();
            if (initializer != null)
              take(">");

            Link left = parseLink(def);

            if (left.alias != null && (is("=") || is("*"))) {
              // Alias-in: alias = port Part
              final boolean multitap = tryToTake("*");
              take("=");
              Link right = parseLink(def);
              right.dereference(def);
              
              if (multitap) {
                if (def.multiPortsList.get(left.alias) != null)
                  throw new RuntimeException("Redefinition of alias*");
                def.multiPortsList.put(left.alias, right.inPort());  
              } else {
                if (def.portsList.get(left.alias) != null)
                  throw new RuntimeException("Redefinition of alias");
                def.portsList.put(left.alias, right.inPort());  
              }

              // TODO: does initialization make sense for multiports?
              if (left.initializer != null) {
                if (initializer != null) 
                  throw new ParseError("Double initialization");
                initializer = left.initializer;
              }
              left = right;
            }

            while (true) {  // Loop over links
              if (initializer != null) {
                def.initialize(initializer, left.inPort());
                initializer = null;
              }

              if (tryToTake("=")) {
                // Alias-out  Part port = alias
                Link right = parseLink(def);
                if (right.alias == null)
                  throw new ParseError("Alias expected");
                def.portsList.put(right.alias, left.outPort());  
                if (right.initializer != null)
                  def.initialize(right.initializer, left.outPort());
                // Just leave left there; thus P = a > Q works...(so what)
              } else if (tryToTake(">")) {
                Link right = parseLink(def);
                // Connection
                left.dereference(def);
                right.dereference(def);
                def.connect(left.outPort(), right.inPort());
                left = right;
              } else {
                // end of chain
                break;
              }
            }
            
            // Advance to next chain, or finish if none
            if (!tryToTake(",")) {
              for (take(T_NEWLINE); is(T_NEWLINE); take(T_NEWLINE)) { }
              if (tokenMatcher.group(T_WHITESPACE).length() == 0)
                break;
            }
          }

          if (def.partsList.size() > 0 && 
              !def.partsList.getFirst().isPositioned())
            def.detectUnassignedPorts();

          // TODO: validate assembly (refers to ports that exist, etc)
        }
      }
    }
  }


  private class Link {
    String portIn = null;
    String partType = null;
    String partName = null;
    String portOut = null;
    String alias = null;
    Double initializer = null;
    Integer x = null;  // designed...
    Integer y = null;  // ...location

    void dereference(AssemblyDef def) throws ParseError {
      if (alias != null) {
        AssemblyDef.PortDef v = def.portsList.get(alias);
        // TODO? if (v == null) throw new RecognitionException(input);
        if (v == null) throw new ParseError("Unrecognised alias");
        partName = v.part;
        partType = def.getPart(v.part).type;
        portIn = v.port;
        portOut = v.port; 
        alias = null;
      } 
    }
    
    AssemblyDef.PortDef inPort() {
      return new AssemblyDef.PortDef(partName, 
                                     (portIn != null) ? portIn : "in");
    }
    
    AssemblyDef.PortDef outPort() {
      return new AssemblyDef.PortDef(partName, 
                                     (portOut != null) ? portOut : "out");
    }
  }


  private Link parseLink(AssemblyDef def) throws ParseError {
    Link result = new Link();

    // Alias name or in port
    if (is(T_LCID))
      result.portIn = take(T_LCID);

    if (!is(T_UCID)) {
      // Alias
      result.alias = result.portIn;
      result.portIn = null;
      if (result.alias == null) throw new ParseError("Chaining part expected");
      if (tryToTake("(")) {
        // Alias can be followed by an initializer like "(10)"
        result.initializer = parseNumeric();
        take(")");
      }
      return result;  // An alias
    }

    // Type and name
    result.partName = take(T_UCID);
    if (is(T_UCID)) {
      result.partType = result.partName;
      result.partName = take(T_UCID);
    }

    // Declare the part, if need be
    AssemblyDef.PartDecl partDecl = def.getPart(result.partName);
    if (partDecl != null) {
      // Already declared -- check consistency
      if (result.partType != null) 
        if (!result.partType.equals(partDecl.type))
          throw new ParseError("Inconsitent declaration");
    } else {
      // Declare it
      partDecl = def.declarePart(result.partType, result.partName);  
    }
    
    // Settings
    if (tryToTake("(")) {
      while (true) {
        String port = take(T_LCID);
        take("=");
        double value = parseNumeric();
        def.connect(new AssemblyDef.PortDef(value),
                    new AssemblyDef.PortDef(result.partName, port)); 
        if (tryToTake(")")) 
          break;
        take(",");
      }
    }

    // Look for a location 
    if (is(T_LOCATION)) {
      String[] coords = take(T_LOCATION).split("@", 2);
      partDecl.left = Integer.parseInt(coords[0]);
      partDecl.top = Integer.parseInt(coords[1]);
    }

    // Out port
    if (is(T_LCID)) 
      result.portOut = take(T_LCID);

    return result;
  }

  private Double parseNumeric() throws ParseError {
    Double r = tryToParseNumeric();
    if (r == null)
      throw new ParseError("Numeric value expected");
    return r;
  }

  private Double tryToParseNumeric() throws ParseError {
    Double result = null;
    if (is(T_NUMBER)) {
      result = Double.parseDouble(take());
    } else if (is(T_QUOTED)) {
      result = (double)Part.addString(take(T_QUOTED));
    } else if (tryToTake("FRAME_PERIOD")) {
      result = Part.FRAME_PERIOD;
    } else if (tryToTake("FRAME_RATE")) {
      result = 1.0 / Part.FRAME_PERIOD;
    } else if (tryToTake("PI")) {
      result = Math.PI;
    } else if (tryToTake("E")) {
      result = Math.E;
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
    // Parse and print assemblies in argument
    Vector<String> names = new Vector<String>(args.length);
    parseArgs(args, names, null);

    if (names.size() > 0) {
      // Print requested defs
      for (String name : names) {
        String type = AssemblyDef.impliedType(name);
        AssemblyDef.registry.get(type).print(System.err);
      }
    } else {
      // All of them
      for (Iterator i = AssemblyDef.registry.keySet().iterator();
           i.hasNext(); ) {
        AssemblyDef.registry.get(i.next()).print(System.err);
        System.err.println();
      }
    }
  }


  static void parseArgs(String args[], 
                        Vector<String> names,
                        Vector<Part> parts) {
    // TODO: Do this if no other def's mentioned?
    // parseFile("std.td");

    runTests();

    Part prev = null;
    String prevoutport = null;
    for (String arg : args) {

      if (arg.equals(",")) {
        // Start a new component chain
        prev = null;

      } else if (arg.endsWith(".td")) {
        // Parse any .td files specified
        parseFile(arg);

      } else if (arg.equals("--list")) {
        for (String a : AssemblyDef.registry.keySet()) {
          System.err.println(a);
          // Make sure they can be built
          Part p = AssemblyDef.registry.get(a).build();
        }
        System.exit(0);

      } else if (arg.equals("-s")) {
        // Parse standard definitions
        parseFile("std.td");

      } else if (arg.contains("=")) {
        // A numerical setting
        if (parts != null) {  
          String[] keyval = arg.split("=", 2);
          Double d;  // no bra jokes please
          try {
            TonedefParser p = new TonedefParser(keyval[1]);
            d = p.tryToParseNumeric();
          } catch (ParseError e) {
            d = null;
          }
          parts.lastElement().port(keyval[0]).storage = (d != null) ? d :
            Part.addString(keyval[1]);
        }

      } else {
        String inport = "in";
        String partname = arg;
        String outport = "out";
        if (arg.contains(".")) {
          String[] ppp = arg.split("\\.");
          System.out.println(ppp.length);
          if (Character.isLowerCase((ppp[0].charAt(0)))) {
            inport = ppp[0];
            partname = ppp[1];
          } else {
            partname = ppp[0];
          }
          if (Character.isLowerCase(ppp[ppp.length-1].charAt(0))) {
            outport = ppp[ppp.length-1];
          }
        }
        String type = AssemblyDef.impliedType(partname);
        AssemblyDef def = AssemblyDef.registry.get(type);
        if (def == null && (new File(type + ".td")).exists()) {
          parseFile(type + ".td");
          def = AssemblyDef.registry.get(type);
        }
        if (def == null) {
          System.err.println("Definition not found: " + type);
          System.exit(404);
        }
        names.add(partname);
        if (parts != null) {
          Part part = def.build();
          parts.add(part);
          part.name = partname;
          
          if (prev != null) {
            if (!part.connectSource(inport, prev, prevoutport)) {
              System.err.println("Unchainable components: " + 
                                 prev.name + " -> " + part.name);
              System.exit(2);
            }
          }

          prev = part;
          prevoutport = outport;
        }
      }
    }
  }
}
