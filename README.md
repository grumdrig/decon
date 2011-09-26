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

    TypeName = TYPESPEC

where TYPESPEC is either a type name, a structure type specification,
an array type specification, or a numeric type specification.

Type names must start with a capital letter. [Subject to change.]

The primary atomic type is the numeric, which can only be specified by
another named type, which may be modified by a set of suffixen. For
example:

    UInt = Int.unsigned

An array represents repeating values in a file and is specified by
giving a length, directly or indirectly, in brackets. Some
examples:

    Point3D = Int[3]
    Matrix3D = Int[3][3]
    Cstring = Char[until 0]
    Line = Char[through '\n']
    Tail = Char[]

Besides giving an explicit length between the brackets termination
conditions can be given too:

* `until X` terminates the array when terminating `X` is consumed but
does not include it as part of the value

* `through X` does include the terminating value in the parsed result

* `before X` terminates the array without consuming the terminator

No terminator (empty braces) specifies an array that is as long as the
data allows

Structures parse sequential information and are specified by listing
field specifications, a name and a type, between braces, e.g.:

    PersonalInfo = {
      name String
      age Int
    }

