#!/usr/bin/env node
'use strict'

const {noLoc} = require('./consts.js')

var babylon = require('babylon')
const compile = require('./js-item-to-re.js').compile;

const getStdin = require('get-stdin');

function injectPreludeOpener() {
  return {pstr_desc:['Pstr_open',{popen_lid:{txt:['Lident','ReJsPrelude'], loc:noLoc},popen_override:['Fresh'],popen_loc:noLoc,popen_attributes:[]}],pstr_loc:noLoc};
}

function jsToRe(js) {
  let initEnv = {isTopLevel: true};
  return [
    [injectPreludeOpener()].concat(
      js.program.body.map(item => ({pstr_desc: compile(initEnv, item), pstr_loc: noLoc}))
    ),
    []
  ];
}

var readStdin = done => {
  if (process.argv.length > 2) {
    return done(process.argv[2])
  }
  var text = ''
  process.stdin.setEncoding('utf8');

  process.stdin.on('readable', () => {
    var chunk = process.stdin.read();
    if (chunk !== null) {
      text = text + chunk.toString('utf8')
    }
  });

  process.stdin.on('end', () => {
    done(text)
  });
}

readStdin(str => {
  var ast = babylon.parse(str)
  console.log(JSON.stringify(jsToRe(ast)))
});

