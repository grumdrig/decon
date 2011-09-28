decon.js: Binary file deconstructor
===================================

In tandem with a file giving its structure, decon.js deconstructs
binary data into a JSON structure.


Construction file grammar
-------------------------

A construction file consists of any number of import statements and
type definitions. An import statement such as

    import "standard.con"

instructs decon to parse the named file.

Type statments give a name to a specified type and take the form

    TypeName: TYPESPEC

where TYPESPEC is either a type name, a structure type specification,
an array type specification, or a numeric type specification.

The elemental atomic types are `byte`, `bool`, `char` and `null`, on
which futher atomic types may be based by applying modifiers, either
as prefixen or dotted suffixen. (TODO: Settle on one syntax or the
other)

    uint: int.unsigned
    uword: unsigned size(2) int

Legal modifiers are `signed`, `unsigned`, `bigendian`, `littleendian`,
and `size N` for some value `N`, which gives the size in bits of the
data type.

An array represents repeating fields of the same type in a file and is
specified by giving a length, directly or indirectly, in brackets.
Some examples:

    Point3D: int[3]
    Matrix3D: int[3][3]
    Cstring: char[until 0]
    Line: char[through '\n']
    Tail: char[]

An array of `char`s is interpreted as a string.

Besides giving an explicit length between the brackets termination
conditions can be given too:

* `until X` terminates the array when terminating `X` is consumed but
does not include it as part of the value

* `through X` does include the terminating value in the parsed result

* `before X` terminates the array without consuming the terminator

No terminator (empty braces) specifies an array that is as long as the
data allows.

Structures parse sequential records of different types and are
specified by listing field specifications, a type and/or value and
optional name, between braces, e.g.:

    PersonalInfo: {
      "PINF" tag
      String name
      int    age
    }

A literal value, if given is tested against the value read from the
file, and deconstruction is aborted if they do not match.


Usage
-----

From the command line, usage is

    node decon.js [DEF.con...] MAIN [IN [OUT]]

where `MAIN` is the root type, defined in some `.con` file listed,
used to parse the binary file `IN` (or read from stdin). The resulting
JSON structure is written to the name OUT` file, or stdout.

Within node, use, for example:

    var decon = require("decon")
    decon.parse("int = size(16) littleendian byte");
    var bmpcon = decon.import("bmp.con").BitmapFile;
    var bmp = bmpcon.deconstructFile("BitmapFile", "dib.bmp");
    console.log("Width = " + bmp.info.width);

