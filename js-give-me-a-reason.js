#!/usr/bin/env node
'use strict'

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
  return [js.program.body.map(item => ({pstr_desc: jsItemToRe(item, true), pstr_loc: noLoc})), []] // no comments for now
}

readStdin(text => {
  var ast = babylon.parse(text)
  console.log(JSON.stringify(jsToRe(ast)))
})
