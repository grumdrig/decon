var decon = require("./decon");
#decon.import("standard.con");
var Jelly = decon.parse("Jelly = { Int[2] f }").Jelly;
var tree = Jelly.deconstructFile("test.con");
console.log(tree);
