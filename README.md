decon.js: Binary file deconstructor
===================================

In tandem with a file giving its structure, decon.js deconstructs
binary data into a JSON structure.

For example, deconstructing [a very tiny PNG file]
(http://garethrees.org/2007/11/14/pngcrush/) using this definition:

    PNG: bigendian {
      byte[8] ([137,80,78,71,13,10,26,10]) signature
      Chunk[] chunks
    }.select(chunks)

    Chunk: {
      uint32 length
      char[4] type
      byte[length] data
      byte[4] crc
    }

produces this output:

    [ { length: 13, type: 'IHDR', data: [ 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0 ], crc: [ 31, 21, 196, 137 ] },
      { length: 10, type: 'IDAT', data: [ 120, 156, 99, 0, 1, 0, 0, 5, 0, 1 ], crc: [ 13, 10, 45, 180 ] },
      { length: 0, type: 'IEND', data: [], crc: [ 174, 66, 96, 130 ] } ]



Deconstruction definition grammar
---------------------------------

A construction file consists of any number of import statements and
type and constant definitions. An import statement such as

    import "record.con"

instructs decon to parse the named file.

Type statments give a name to a specified type and take the form

    TypeName: TYPESPEC

where `TYPESPEC` is either a type name, a structure type specification,
an array type specification, or a numeric type specification.

The elemental atomic types are `byte`, `bool`, `char` and `null`, on
which futher atomic types may be based by applying modifiers, either
as prefixen or dotted suffixen. 

    uint: int.unsigned
    uword: unsigned size(16) int

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

Unions represent a number of alternatives. E.g.:

    PetRecord: union {
      CatRecord
      DogRecord
    }

The first matching type (that is, whose values verify against the
data) in the union will become the value of the union. Field names
given in a union are ignored. Give "null" as the last type in the
union to allow the union to not match at all.

An example of a union:

    PlanetData: { PlanetRecord[] facts; }

    PlanetRecord = union {
      { "satellite:"; cstring moon }
      { "diameter:"; int32 diameter }
    }

Which would process input
 
    "diameter:\212\015\000\000satellite:Phobos\000satellite:Deimos\000"

into

    { facts: [{moon: "Phobos"}, {moon: "Deimos"}, {diameter: 6794}] }


Usage
-----

From the command line, usage is

    node decon.js [OPTIONS] [DEF.con...] MAIN

where `MAIN` is the root type, defined in some `.con` file listed,
used to parse a binary file, and write the resulting JSON structure.

OPTIONS are

* `-p`      Partial parsing of the input is okay
* `-v`      Verbose: print extra debugging information
* `-V VAR`  Produce JavaScript (prepend `var VAR = `)
* `-i FILE` Read from the named file rather than `stdin`
* `-o FILE` Write to the named file rather than `stdout`
* `-h`      Produce somewhat more human-readable output

Within node, use, for example:

    var decon = require("decon")
    decon.parse("int = size(16) littleendian byte");
    var bmpcon = decon.import("bmp.con").BitmapFile;
    var bmp = bmpcon.deconstructFile("BitmapFile", "dib.bmp");
    console.log("Width = " + bmp.info.width);

