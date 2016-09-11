const {noPos, noLoc, patNull, expNull} = require('./consts.js')

let fail = null;

let arraysAsLists = true;

var lidentLoc = (name) => {
  return {txt: ['Lident', name], loc: noLoc};
};
let Pexp_construct = (constructorName, optionalExpression) => [
  'Pexp_construct',
  lidentLoc(constructorName),
  optionalExpression == null ? null : optionalExpression
];



let Pexp_ident = (lidentLoc) => [
  'Pexp_ident',
  lidentLoc
];


let Pexp_tuple = (lst) => ['Pexp_tuple', lst];

let nil = Pexp_construct('[]', null);
let unit = Pexp_construct('()', null);

let cons = (hd, tl) => {
  return Pexp_construct(
    '::',
    expression(Pexp_tuple([hd, tl]))
  );
};


let List = {
  length: (lst) => lst.length,
  hd: (lst) => lst[0],
  tl: (lst) => {
    return lst.length === 0 ?
      fail('Cannot take tail of zero len list') :
      lst.slice(1);
  }
};

let jsArrayToReasonList = (lst) => {
  return (List.length(lst) == 0) ? nil :
    cons(
      expression(jsItemToRe(List.hd(lst))),
      expression(jsArrayToReasonList(List.tl(lst)))
    );
};

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

var functionToReason = ({body, params}) => {
  let bod = jsItemToRe(body);
  if (!params.length) {
    return funShell(patNull, bod)
  }
  for (let i=params.length - 1; i>=0; i--) {
    bod = funShell(['Ppat_var', {txt: params[i].name, loc: noLoc}], bod)
  }

  return bod
};

let functionDeclarationToVariableBinding = (e) => {
  let name = e.id.name;
  return {
    type: 'VariableDeclaration',
    start: 0,
    end: 0,
    loc: null,
    declarations: [
      {
        type: 'VariableDeclarator',
        id: {name: name},
        init: {type: 'ArrowFunctionExpression', body: e.body, params: e.params},
        kind: null
      }
    ]
  };
};


var jsOperatorToMlMap = {
  // Js tripple equal is Reason tripple equal (ml double equal).
  '===': '==',
  // Js double equal is still Reason tripple equal (ml double).
  '==': '==',
  // Js tripple nequal is Reason tripple nequal (ml double nequal).
  '!==': '!=',
  '!=': '!='
};

var jsOperatorToMlAst = (jsOp) => {
  return jsOperatorToMlMap[jsOp] || jsOp;
};

var tuple = (args) => {
  return {
    pexp_desc: [
      'Pexp_tuple',
      args.map((arg) => ({
          pexp_desc: jsItemToRe(arg),
          pexp_loc: noLoc,
          pexp_attributes: []
        })
      )
    ],
    pexp_loc: noLoc,
    pexp_attributes: []
  };
};

var explictArityify = (tuple) => {
  return {
    pexp_desc: tuple.pexp_desc,
    pexp_loc: tuple.pexp_loc,
    pexp_attributes: tuple.pexp_attributes.concat([])
  };
};


let expression = (exprDesc) => ({
  pexp_desc: exprDesc,
  pexp_loc: noLoc,
  pexp_attributes: []
});

var variant = (name, args) => {
  var variantName = name.charAt(0).toUpperCase() + name.substr(1);
  return {
    pexp_desc: ['Pexp_construct', {txt: ['Lident', variantName], loc: noLoc}, tuple(args)],
    pexp_loc: noLoc,
    pexp_attributes: []
  };
}

var applicationArgs = (args) =>
    args.map(arg => [
      "",
      {
        pexp_desc: jsItemToRe(arg),
        pexp_loc: noLoc,
        pexp_attributes: []
      }
    ]);

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
  BooleanLiteral: (e) => {
    return jsByTag.Identifier({name: '' + e.value});
  },

  ExpressionStatement: ({expression}, isTopLevel) =>
    statement(jsItemToRe(expression), isTopLevel)
  ,

  BlockStatement: ({body}) => {
    if (!body.length) return expNull;
    let res = jsItemToRe(body[body.length - 1])
    for (let i=body.length - 2; i>=0; i--) {
      if (body[i].type === 'VariableDeclaration' || body[i].type === 'FunctionDeclaration') {
        let normalizedBody = (body[i].type === 'FunctionDeclaration') ?
          functionDeclarationToVariableBinding(body[i]) :
          body[i];
        res = [
          'Pexp_let',
          ['Nonrecursive'],
          normalizedBody.declarations.map(jsItemToRe),
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
    expression(jsItemToRe(test)),
    expression(jsItemToRe(consequent)),
    alternate ? expression(jsItemToRe(alternate)) : null,
  ], isTopLevel),
  SwitchStatement: fail,
  SwitchCase: fail,

  /**
   * If the pattern is `throw new X(argOne, argTwo)` we should turn that into:
   *
   * raise (X argOne argTwo)
   *
   * Because chances are you have to turn the X into an exception anyway.
   */
  ThrowStatement: ({argument}) => {
    let thingToRaise =
        argument.type === 'NewExpression' &&
        argument.callee.type === 'Identifier' ?
      variant(argument.callee.name, argument.arguments) :
      {
        pexp_desc: jsItemToRe(argument),
        pexp_loc: noLoc,
        pexp_attributes: []
      };
    return [
      'Pexp_apply',
      expression(['Pexp_ident', lidentLoc('raise')]),
      [
        ["", thingToRaise]
      ]
    ];
  },
  TryStatement: fail,
  CatchClause: fail,
  WhileStatement: (e, isTopLevel) => {
    return statement([
      'Pexp_while',
      expression(jsItemToRe(e.test)),
      expression(jsItemToRe(e.body))
    ], isTopLevel);
  },
  DoWhileStatement: fail,
  ForStatement: fail,
  ForInStatement: fail,
  ForOfStatement: fail,

  /**
   * TODO: Definitely make these recursive.
   */
  FunctionDeclaration: (e, isTopLevel) => {
    let name = e.id.name;
    let fakeVariableDecl = functionDeclarationToVariableBinding(e);
    return jsItemToRe(fakeVariableDecl, isTopLevel);
  },

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
      pexp_desc:
        init ? jsItemToRe(init) :
        ['Pexp_construct', {txt: ['Lident', 'None'], loc: noLoc}, null],
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
  ArrowFunctionExpression: functionToReason,
  YieldExpression: fail,
  AwaitExpression: fail,

  ArrayExpression: e => jsArrayToReasonList(e.elements),
  ObjectExpression: e => {
    let propertyToRecordField = (property) => {
      let keyName = property.key.type === 'Identifier' ?
        property.key.name :
        'unsupportedProperty';
      return [
        lidentLoc(keyName),
        expression(jsItemToRe(property.value))
      ];
    };
    return [
      'Pexp_record',
      e.properties.map(propertyToRecordField),
      null /* The "with" portion */
    ];
  },
  ObjectMember: fail,
  ObjectProperty: fail,
  ObjectMethod: fail,
  RestProperty: fail,
  SpreadProperty: fail,
  FunctionExpression: functionToReason,
  UnaryExpression: (e, isTopLevel) => {
    return [
      'Pexp_apply',
      expression([
        'Pexp_ident',
        lidentLoc(jsOperatorToMlAst(e.operator))
      ]),
      applicationArgs([e.argument])
    ];
  },
  UpdateExpression: e => {
    // x++ becomes x.contents = x.contents + 1
    let reasonOperationIdent =
      e.operator === '++' ?  lidentLoc('+') :
      e.operator == '--' ? lidentLoc('-') : null;
    if (reasonOperationIdent === null) {
      throw new Error('Cannot determine update identifier');
    }
    let operand = expression(jsItemToRe(e.argument));
    return [
      'Pexp_setfield',
      operand,
      lidentLoc('contents'),
      expression([
        'Pexp_apply',
        expression(['Pexp_ident', reasonOperationIdent]),
        [
          ["", expression(['Pexp_field', operand, lidentLoc('contents')])],
          ["", expression(['Pexp_constant', ['Const_int', 1]])]
        ]
      ])
    ];
  },
  BinaryExpression: ({left, right, operator}) => jsItemToRe({
    type: 'CallExpression',
    callee: {type: 'Identifier', name: jsOperatorToMlAst(operator)},
    arguments: [left, right]
  }),
  AssignmentExpression: ({left, right, operator}) => operator === '=' ?
  (left.type === 'Identifier' ? [
    'Pexp_setfield',
    expression(Pexp_ident(lidentLoc(left.name))),
    lidentLoc('contents'),
    {pexp_desc: jsItemToRe(right), pexp_loc: noLoc, pexp_attributes: []},
  ] : (left.type === 'MemberExpression' && !left.computed ? [
    'Pexp_setfield',
    {pexp_desc: jsItemToRe(left.object), pexp_loc: noLoc, pexp_attributes: []},
    {txt: ['Lident', left.property.name], loc: noLoc},
    {pexp_desc: jsItemToRe(right), pexp_loc: noLoc, pexp_attributes: []},
  ] : (left.type === 'MemberExpression' && left.computed) ? [
    /* TODO: Perform basic type inference to determine if this is an array
     * update or a hash table update */
      'Pexp_apply',
      {
        pexp_desc: [
          'Pexp_ident',
          {txt: ['Ldot', ['Lident', 'Array'], 'set'], loc: noLoc}
        ],
        pexp_loc: noLoc,
        pexp_attributes: []
      },
      applicationArgs([left.object, left.property, right])
  ] : fail("Cannot assign much"))) : (
    jsItemToRe({
      type: 'CallExpression',
      callee: {type: 'Identifier', name: operator},
      arguments: [left, right]
    })
  ),

  LogicalExpression: ({left, right, operator}) => jsItemToRe({
    type: 'CallExpression',
    callee: {type: 'Identifier', name: jsOperatorToMlAst(operator)},
    arguments: [left, right]
  }),
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
    applicationArgs([object, property])
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

  ConditionalExpression: (e) => {
    return [
      'Pexp_match',
      expression(jsItemToRe(e.test)),
      [
        {
          "pc_lhs":{
            "ppat_desc":["Ppat_construct",{"txt":["Lident","true"],"loc":noLoc},null],
            "ppat_loc":noLoc,
            "ppat_attributes":[]
          },
          "pc_guard":null,
          "pc_rhs": expression(jsItemToRe(e.consequent))
        },
        {
          "pc_lhs":{
            "ppat_desc":["Ppat_construct",{"txt":["Lident","false"],"loc":noLoc},null],
            "ppat_loc":noLoc,
            "ppat_attributes":[]
          },
          "pc_guard":null,
          "pc_rhs": expression(jsItemToRe(e.alternate))
        }
      ]
    ]
  },

  CallExpression: ({callee, arguments}) => [
    'Pexp_apply',
    {
      pexp_desc: jsItemToRe(callee),
      pexp_loc: noLoc,
      pexp_attributes: []
    },
    arguments.length > 0 ? applicationArgs(arguments) : [["", expression(unit)]]
  ],

  NewExpression: (e) => {
    let calleeName =
      e.callee.type ===
        'Identifier' ? e.callee.name.charAt(0).toLowerCase() +
        e.callee.name.substr(1) :
      'todoCannotSupportClassesThatAreNotIdentifiers';
    return [
      'Pexp_apply',
      {
        pexp_desc: [
          'Pexp_new',
          {txt: ['Lident', calleeName], loc: noLoc}
        ],
        pexp_loc: noLoc,
        pexp_attributes: []
      },
      applicationArgs(e.arguments)
    ];
  },
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
  if (!jsByTag[item.type] || typeof jsByTag[item.type] !== 'function') {
    console.log('Unknown type', item.type)
  }
  if (!jsByTag[item.type]) {
    throw new Error("No Tag for:" + item.type + JSON.stringify(item))
  }
  return jsByTag[item.type](item, isTopLevel)
}

module.exports = jsItemToRe;
