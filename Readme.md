# Javascript to [Reason](https://github.com/facebook/reason) transpiler

This uses babel to parse javascript, and then translates that AST into the
Ocaml AST, outputting JSON that refmt can accept.

To use:

```
$ ./run.sh 'alert("hello world")'
alert "hello world";
```

## Motivation and Use Cases:
The goal of `rejs` is to help automate the process of porting JavaScript libraries into [Reason](https://github.com/facebook/reason). Eventually, if complete enough, `rejs` would generate a Reason project that is "correct", but that does not type check. The user would then need to fix all of the type errors, and do some basic refactoring in order to complete the port. `rejs` should cut out the most boring part of porting libraries - manually transcribing code from one language/syntax to another.

### Strategies:
`rejs` is very new, and incomplete, but a few approaches should be explored.
- Transpiling `JavaScript` records to ML records (which requires a bunch of manual work to get it to type check).
- Transpiling `JavaScript` records to ML objects (which requires less manual work, but limits performance of resulting library).
- Embed placeholder strings of JS text where the port is not yet complete, which developers must manually port.


### Why not port a library to `Reason`?
- Sometimes, a library will only be maintained in JavaScript for the foreseeable future, and you may not want to keep up your `Reason` fork with ongoing changes upstream. `rejs`'s goal is to be a tool for `JavaScript` library maintainers, or people looking to fork `JavaScript` libraries to performance oriented ports.
- You may not be interested in porting your `JavaScript` library to `Reason` if your library doesn't have strict performance requirements, or if you do not see the value in sound+static type checking.

### Why *should* you port a library to `Reason`?
You may want to port a library into `Reason` if:
- You want to benefit from sound, static typing.
- You want your library to run in as many environments as possible, with the best performance possible for each environment. A library written in `Reason` has strictly more options for deployment and performance outcomes. For example, you may compile your `Reason` library as a native binary, running without a VM for maximum performance, but you may also compile that same library to `JavaScript` - you don't have to choose up front.

## Setup
You need `Reason` with [this PR applied](https://github.com/facebook/reason/pull/755), built in a directory
adjacent to where you have this repo. You'll clone `Reason` and checkout the `JsonSupport` branch which has that PR applied.
e.g.

**Make sure you've pinned all the required packages mentioned in the [Contributing To Development](https://github.com/facebook/reason#install-stable) section of the Reason README**
```
git clone https://github.com/facebook/Reason
(cd Reason; git checkout JsonSupport; make)
git clone https://github.com/jaredly/rejs
cd rejs
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
