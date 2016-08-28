#!/usr/bin/env node
'use strict'

var babylon = require('babylon')

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

var noPos = {pos_fname: 'hah', pos_lnum: 0, pos_cnum: 0, pos_bol: 0}
var noLoc = {loc_start: noPos, loc_end: noPos, loc_ghost: false}

function statement(body) {
  return [
    'Pstr_eval',
    {
      pexp_desc: body,
      pexp_loc: noLoc,
      pexp_attributes: []
    },
    [] // attributes
  ]
}

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

var jsByTag = {
  ExpressionStatement: ({expression}, isTopLevel) => isTopLevel ?
    statement(jsItemToRe(expression)) : jsItemToRe(expression)
  ,
  CallExpression: ({callee, arguments}) => [
    'Pexp_apply',
    {
      pexp_desc: jsItemToRe(callee),
      pexp_loc: noLoc,
      pexp_attributes: []
    },
    arguments.map(arg => [
      "",
      {
        pexp_desc: jsItemToRe(arg),
        pexp_loc: noLoc,
        pexp_attributes: []
      }
    ])
  ],
  Identifier: ({name}) => [
    'Pexp_ident',
    {
      txt: ['Lident', name],
      loc: noLoc
    }
  ],

  StringLiteral: ({value}) => ['Pexp_constant', ['Const_string', value, null]],
  NumericLiteral: ({value}) => ['Pexp_constant', ['Const_int', value]],

  BinaryExpression: ({left, right, operator}) => jsItemToRe({
    type: 'CallExpression',
    callee: {type: 'Identifier', name: operator},
    arguments: [left, right]
  }),
  VariableDeclaration: ({declarations}, isTopLevel) => isTopLevel ? [
    'Pstr_value',
    ['Nonrecursive'],
    renderDecl(declarations)
  ] : [
    'Pexp_let',
    ['Nonrecursive'],
    renderDecl(declarations),
    {
      pexp_desc: ['Pexp_construct', {txt: ['Lident', '()'], loc: noLoc}, null],
      pexp_loc: noLoc,
      pexp_attributes: [],
    }
  ],
  ArrowFunctionExpression: ({body, params}) => {
    let bod = jsItemToRe(body);
    if (!params.length) {
      return funShell(['Ppat_construct', {txt: ['Lident', '()'], loc: noLoc}, null], bod)
    }
    for (let i=params.length - 1; i>=0; i--) {
      bod = funShell(['Ppat_var', {txt: params[i].name, loc: noLoc}], bod)
    }

    return bod
  },
  BlockStatement: ({body}) => {
    let res = jsItemToRe(body[body.length - 1])
    for (let i=body.length - 2; i>=0; i--) {
      if (body[i].type === 'VariableDeclaration') {
        res = [
          'Pexp_let',
          ['Nonrecursive'],
          renderDecl(body[i].declarations),
          {pexp_desc: res, pexp_loc: noLoc, pexp_attributes: []},
        ]
      } else {
        res = [
          'Pexp_sequence',
          {pexp_desc: jsItemToRe(body[i]), pexp_loc: noLoc, pexp_attributes: []},
          {pexp_desc: res, pexp_loc: noLoc, pexp_attributes: []},
        ]
      }
    }

    return res
  },
  ReturnStatement: ({argument}) => jsItemToRe(argument),
  IfStatement: ({test, consequent, alternate}) => statement([
    'Pexp_ifthenelse',
    {pexp_desc: jsItemToRe(test), pexp_attributes: [], pexp_loc: noLoc},
    {pexp_desc: jsItemToRe(consequent), pexp_attributes: [], pexp_loc: noLoc},
    alternate ? {pexp_desc: jsItemToRe(alternate), pexp_attributes: [], pexp_loc: noLoc} : null,
  ])
}

function funShell(arg, body) {
  return ['Pexp_fun', '', null, {
    ppat_desc: arg,
    ppat_loc: noLoc,
    ppat_attributes: [],
  }, {
    pexp_desc: body,
    pexp_loc: noLoc,
    pexp_attributes: [],
  }]
}

function jsItemToRe(item, isTopLevel) {
  if (!jsByTag[item.type]) {
    console.log('Unknown type', item.type)
  }
  return jsByTag[item.type](item, isTopLevel)
}

function jsToRe(js) {
  return [js.program.body.map(item => ({pstr_desc: jsItemToRe(item, true), pstr_loc: noLoc})), []] // no comments for now
}

readStdin(text => {
  var ast = babylon.parse(text)
  console.log(JSON.stringify(jsToRe(ast)))
})
