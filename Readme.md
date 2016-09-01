# Javascript to Reason transpiler

This uses babel to parse javascript, and then translates that AST into the
Ocaml AST, outputting JSON that refmt can accept.

To use:

```
$ ./run.sh 'alert("hello world")'
alert "hello world";
```

## How to contribute
Lots of AST forms haven't been processed yet.

Look in `js-item-to-re.js`, and you can use
https://github.com/babel/babylon/blob/master/ast/spec.md as a guide.

To find out what the desired Reason AST looks like, you can do
```
echo 'alert "hi"'|../Reason/refmt_impl.native  -parse re -print json -use-stdin true -is-interface-pp false
```

To find out what JS ast looks like:
```
./jsdump.js 'alert("hi")'
```

## Some more fancy transformations

### Return statement control flow
Translating
```
function() {
  if (x) {
    a()
    return b
  }
  c()
  return d
}
```
into
```
function() {
  if (x) {
    a()
    b
  } else {
    c()
    d
  }
}
```

Another option is to just add a `[@return]` annotation, to remind you to go
through and make the return actually return. B/c some things would be pretty
difficult (returning in the middle of a for loop, for example)
