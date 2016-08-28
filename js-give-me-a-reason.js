#!/usr/bin/env node
'use strict'

var babylon = require('babylon')

var readStdin = done => {
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

var noPos = {pos_fname: 'hah', pos_lnum: 0, pos_cnum: 0, pos_bol: 0}
var noLoc = {loc_start: noPos, loc_end: noPos, loc_ghost: false}

var jsByTag = {
  ExpressionStatement: ({expression}) => ['Pstr_eval', {pexp_desc: jsItemToRe(expression), pexp_loc: noLoc, pexp_attributes: []}, []],
  CallExpression: ({callee, arguments}) => ['Pexp_apply', {pexp_desc: jsItemToRe(callee), pexp_loc: noLoc, pexp_attributes: []},
    arguments.map(arg => ["", {pexp_desc: jsItemToRe(arg), pexp_loc: noLoc, pexp_attributes: []}])
  ],
  Identifier: ({name}) => ['Pexp_ident', {txt: ['Lident', name], loc: noLoc}],
  StringLiteral: ({value}) => ['Pexp_constant', ['Const_string', value, null]],
  BinaryExpression: ({left, right, operator}) => jsItemToRe({type: 'CallExpression', callee: {type: 'Identifier', name: operator}, arguments: [left, right]}),
  // ['Pexp_apply', {pexp_desc: ['Pexp_ident', {txt: ['Lident', operator], loc: noLoc}], pexp_loc: noLoc, pexp_attributes: []}, []]
  NumericLiteral: ({value}) => ['Pexp_constant', ['Const_int', value]],
}

function jsItemToRe(item) {
  if (!jsByTag[item.type]) {
    console.log('Unknown type', item.type)
  }
  return jsByTag[item.type](item)
}

function jsToRe(js) {
  return [js.program.body.map(item => ({pstr_desc: jsItemToRe(item), pstr_loc: noLoc})), []] // no comments for now
}

readStdin(text => {
  var ast = babylon.parse(text)
  console.log(JSON.stringify(jsToRe(ast)))
})
