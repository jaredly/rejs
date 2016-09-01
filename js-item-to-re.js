
function fail(err) {
  throw new Error(err)
}

function statement(body, isTopLevel) {
  return isTopLevel ? [
    'Pstr_eval',
    {
      pexp_desc: body,
      pexp_loc: noLoc,
      pexp_attributes: []
    },
    [] // attributes
  ] : body
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

const noPos = {pos_fname: 'hah', pos_lnum: 0, pos_cnum: 0, pos_bol: 0}
const noLoc = {loc_start: noPos, loc_end: noPos, loc_ghost: false}
const patNull = ['Ppat_construct', {txt: ['Lident', '()'], loc: noLoc}, null]
const expNull = ['Pexp_construct', {txt: ['Lident', '()'], loc: noLoc}, null]

var jsByTag = {
  Identifier: ({name}) => [
    'Pexp_ident',
    {
      txt: ['Lident', name],
      loc: noLoc
    }
  ],

  NullLiteral: () => ['Pexp_construct', {txt: ['Lident', '()'], loc: noLoc}, null],
  StringLiteral: ({value}) => ['Pexp_constant', ['Const_string', value, null]],
  NumericLiteral: ({value}) => ['Pexp_constant', ['Const_int', value]],
  RegexpLiteral: fail,
  BooleanLiteral: fail,

  ExpressionStatement: ({expression}, isTopLevel) =>
    statement(jsItemToRe(expression), isTopLevel)
  ,

  BlockStatement: ({body}) => {
    if (!body.length) return expNull;
    let res = jsItemToRe(body[body.length - 1])
    for (let i=body.length - 2; i>=0; i--) {
      if (body[i].type === 'VariableDeclaration') {
        res = [
          'Pexp_let',
          ['Nonrecursive'],
          body[i].declarations.map(jsItemToRe),
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

  EmptyStatement: fail,
  DebuggerStatement: fail,
  WithStatement: fail,

  // TODO do some control flow analysis to make this actually be the final
  // statement in a function
  ReturnStatement: ({argument}) => jsItemToRe(argument),
  LabeledStatement: fail,
  BreakStatement: fail,
  ContinueStatement: fail,

  // TODO handle early return in if statement -- convert to else?
  IfStatement: ({test, consequent, alternate}, isTopLevel) => statement([
    'Pexp_ifthenelse',
    {pexp_desc: jsItemToRe(test), pexp_attributes: [], pexp_loc: noLoc},
    {pexp_desc: jsItemToRe(consequent), pexp_attributes: [], pexp_loc: noLoc},
    alternate ? {pexp_desc: jsItemToRe(alternate), pexp_attributes: [], pexp_loc: noLoc} : null,
  ], isTopLevel),
  SwitchStatement: fail,
  SwitchCase: fail,

  ThrowStatement: fail,
  TryStatement: fail,
  CatchClause: fail,
  WhileStatement: fail,
  DoWhileStatement: fail,
  ForStatement: fail,
  ForInStatement: fail,
  ForOfStatement: fail,

  FunctionDeclaration: fail,
  VariableDeclaration: ({declarations}, isTopLevel) => isTopLevel ? [
    'Pstr_value',
    ['Nonrecursive'],
    declarations.map(jsItemToRe),
  ] : [
    'Pexp_let',
    ['Nonrecursive'],
    declarations.map(jsItemToRe),
    {
      pexp_desc: expNull,
      pexp_loc: noLoc,
      pexp_attributes: [],
    }
  ],
  VariableDeclarator: ({id, init, kind}) => ({
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
  }),

  Decorator: fail,
  Directive: fail,
  DirectiveLiteral: fail,

  Super: fail,
  ThisExpression: fail,
  ArrowFunctionExpression: ({body, params}) => {
    let bod = jsItemToRe(body);
    if (!params.length) {
      return funShell(patNull, bod)
    }
    for (let i=params.length - 1; i>=0; i--) {
      bod = funShell(['Ppat_var', {txt: params[i].name, loc: noLoc}], bod)
    }

    return bod
  },
  YieldExpression: fail,
  AwaitExpression: fail,
  ArrayExpression: fail,
  ObjectExpression: fail,
  ObjectMember: fail,
  ObjectProperty: fail,
  ObjectMethod: fail,
  RestProperty: fail,
  SpreadProperty: fail,
  FunctionExpression: fail,
  UnaryExpression: fail,
  UpdateExpression: fail,
  BinaryExpression: ({left, right, operator}) => jsItemToRe({
    type: 'CallExpression',
    callee: {type: 'Identifier', name: operator},
    arguments: [left, right]
  }),
  AssignmentExpression: ({left, right, operator}) => operator === '=' ?
  (left.type === 'Identifier' ? [
    'Pexp_setinstvar',
    {txt: left.name, loc: noLoc},
    {pexp_desc: jsItemToRe(right), pexp_loc: noLoc, pexp_attributes: []},
  ] : (left.type === 'MemberExpression' ? [
    'Pexp_setfield',
    {pexp_desc: jsItemToRe(left.object), pexp_loc: noLoc, pexp_attributes: []},
    {txt: ['Lident', left.property.name], loc: noLoc},
    {pexp_desc: jsItemToRe(right), pexp_loc: noLoc, pexp_attributes: []},
  ] : fail("Cannot assign much"))) : (
    jsItemToRe({
      type: 'CallExpression',
      callee: {type: 'Identifier', name: operator},
      arguments: [left, right]
    })
  ),

  LogicalExpression: fail,
  SpreadElement: fail,
  MemberExpression: ({object, property, computed}) => computed ? [
    'Pexp_apply',
    {
      pexp_desc: [
        'Pexp_ident',
        {txt: ['Ldot', ['Lident', 'Array'], 'get'], loc: noLoc}
      ],
      pexp_loc: noLoc,
      pexp_attributes: []
    },
    [object, property].map(arg => [
      "",
      {
        pexp_desc: jsItemToRe(arg),
        pexp_loc: noLoc,
        pexp_attributes: []
      }
    ])
  ] : [
    'Pexp_field',
    {
      pexp_desc: jsItemToRe(object),
      pexp_loc: noLoc,
      pexp_attributes: [],
    },
    {txt: ['Lident', property.name], loc: noLoc}
  ],

  BindExpression: fail,
  ConditionalExpression: fail,
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

  NewExpression: fail,
  SequenceExpression: fail,
  TemplateLiteral: fail,
  TaggedTemplateExpression: fail,
  TemplateElement: fail,
  AssignmentProperty: fail,
  ObjectPattern: fail,
  ArrayPattern: fail,
  RestElement: fail,
  AssignmentPattern: fail,
  ClassBody: fail,
  ClassMethod: fail,
  ClassProperty: fail,
  ClassDeclaration: fail,
  ClassExpression: fail,
  MetaProperty: fail,

  ImportDeclaration: fail,
  ExportNamedDeclaration: fail,
  ExportDefaultDeclaration: fail,
  ExportAllDeclaration: fail,

}


function jsItemToRe(item, isTopLevel) {
  if (!jsByTag[item.type]) {
    console.log('Unknown type', item.type)
  }
  return jsByTag[item.type](item, isTopLevel)
}

