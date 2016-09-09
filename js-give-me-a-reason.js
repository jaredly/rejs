#!/usr/bin/env node
'use strict'

const {noLoc} = require('./consts.js')

var babylon = require('babylon')
const jsItemToRe = require('./js-item-to-re.js')

var readStdin = done => {
  if (process.argv.length > 2) {
    return done(process.argv[2])
  }
  var text = ''
  process.stdin.setEncoding('utf8');

  process.stdin.on('readable', () => {
    var chunk = process.stdin.read();
    if (chunk !== null) {
      text = chunk.toString('utf8')
    }
  });

  process.stdin.on('end', () => {
    done(text)
  });
}

function injectPreludeOpener() {
  return {pstr_desc:['Pstr_open',{popen_lid:{txt:['Lident','ReJsPrelude'], loc:noLoc},popen_override:['Fresh'],popen_loc:noLoc,popen_attributes:[]}],pstr_loc:noLoc};
}

// TODO remove (unused)
function renderDecl(declarations) {
  return declarations.map(({id, init, kind}) => ({
    pvb_pat: {
      ppat_desc: ['Ppat_var', {txt: id.name, loc: noLoc}],
      ppat_loc: noLoc,
      ppat_attributes: [],
    },
    pvb_expr: {
      pexp_desc: jsItemToRe(init),
      pexp_loc: noLoc,
      pexp_attributes: [],
    },
    pvb_attributes: [],
    pvb_loc: noLoc
  }))
}

function jsToRe(js) {
  return [
    [injectPreludeOpener()].concat(
      js.program.body.map(item => ({pstr_desc: jsItemToRe(item, true), pstr_loc: noLoc}))
    ),
    []
  ];
}

readStdin(text => {
  var ast = babylon.parse(text)
  console.log(JSON.stringify(jsToRe(ast)))
})
