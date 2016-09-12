const {noPos, noLoc, patNull, expNull} = require('./consts.js')

let fail = null;

let arraysAsLists = true;


let Env = {
  topLevel: (env, isTopLevel) => {
    var next = {};
    for(var k in env) {
      next[k] = env[k];
    }
    next.isTopLevel = !!isTopLevel;
    return next;
  }
};

var lidentLoc = (name) => {
  return {txt: ['Lident', name], loc: noLoc};
};


let Pexp_construct = (lidentLoc, optionalExpression) => [
  'Pexp_construct',
  lidentLoc,
  optionalExpression == null ? null : optionalExpression
];


let Pexp_ident = (lidentLoc) => [
  'Pexp_ident',
  lidentLoc
];


let Pexp_field = (exprDesc, lidentLoc) => {
  return [
    "Pexp_field",
    expression(exprDesc),
    lidentLoc
  ];
};

let Pexp_ifthenelse = (test, consequent, alternate) => [
  'Pexp_ifthenelse',
  (test),
  (consequent),
  alternate ? (alternate) : null,
]

let Pexp_tuple = (lst) => ['Pexp_tuple', lst];

let nil = Pexp_construct(lidentLoc('[]'), null);
let unit = Pexp_construct(lidentLoc('()'), null);

let cons = (hd, tl) => {
  return Pexp_construct(
    lidentLoc('::'),
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

let jsArrayToReasonList = (env, lst) => {
  return (List.length(lst) == 0) ? nil :
    cons(
      expression(jsItemToRe(env, List.hd(lst))),
      expression(jsArrayToReasonList(env, List.tl(lst)))
    );
};

let onlyIfNotReturned = (e) => {
  return Pexp_ifthenelse(
    expression([
      "Pexp_apply",
      expression(Pexp_ident(lidentLoc(jsOperatorToMlMap("===")))),
      [
        ["", expression(["Pexp_field", expression(Pexp_ident(lidentLoc("retVal"))), lidentLoc("contents")])],
        ["", expression(Pexp_construct(lidentLoc("None"), null))]
      ]
    ]),
    expression(e),
    expression(Pexp_field(expression(Pexp_ident(lidentLoc("retVal"))), lidentLoc("contents")))
  );
};

function statement(env, body) {
  return env.isTopLevel ? [
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

var functionToReason = (env, {body, params}) => {
  let bod = jsItemToRe(env, body);
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

var tuple = (env, args) => {
  return {
    pexp_desc: [
      'Pexp_tuple',
      args.map((arg) => ({
          pexp_desc: jsItemToRe(env, arg),
          pexp_loc: noLoc,
          pexp_attributes: []
        })
      )
    ],
    pexp_loc: noLoc,
    pexp_attributes: []
  };
};

let expression = (exprDesc) => ({
  pexp_desc: exprDesc,
  pexp_loc: noLoc,
  pexp_attributes: []
});

var variant = (env, name, args) => {
  var variantName = name.charAt(0).toUpperCase() + name.substr(1);
  return {
    pexp_desc: ['Pexp_construct', {txt: ['Lident', variantName], loc: noLoc}, tuple(env, args)],
    pexp_loc: noLoc,
    pexp_attributes: []
  };
}

var applicationArgs = (env, args) =>
    args.map(arg => [
      "",
      {
        pexp_desc: jsItemToRe(env, arg),
        pexp_loc: noLoc,
        pexp_attributes: []
      }
    ]);

var jsByTag = {
  Identifier: (env, {name}) => [
    'Pexp_ident',
    {
      txt: ['Lident', name],
      loc: noLoc
    }
  ],

  NullLiteral: (env) => ['Pexp_construct', {txt: ['Lident', '()'], loc: noLoc}, null],
  StringLiteral: (env, {value}) => ['Pexp_constant', ['Const_string', value, null]],
  NumericLiteral: (env, {value}) => ['Pexp_constant', ['Const_int', value]],
  RegexpLiteral: fail,
  BooleanLiteral: (env, e) => {
    return jsByTag.Identifier(env, {name: '' + e.value});
  },

  ExpressionStatement: (env, {expression}) =>
    statement(env, jsItemToRe(env, expression))
  ,

  BlockStatement: (env, {body}) => {
    if (!body.length) return expNull;
    let res = jsItemToRe(env, body[body.length - 1])
    for (let i=body.length - 2; i>=0; i--) {
      if (body[i].type === 'VariableDeclaration' || body[i].type === 'FunctionDeclaration') {
        let normalizedBody = (body[i].type === 'FunctionDeclaration') ?
          functionDeclarationToVariableBinding(body[i]) :
          body[i];
        res = [
          'Pexp_let',
          ['Nonrecursive'],
          normalizedBody.declarations.map(jsItemToRe.bind(null, env)),
          {pexp_desc: res, pexp_loc: noLoc, pexp_attributes: []},
        ]
      } else {
        res = [
          'Pexp_sequence',
          {pexp_desc: jsItemToRe(env, body[i]), pexp_loc: noLoc, pexp_attributes: []},
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
  ReturnStatement: (env, {argument}) => jsItemToRe(env, argument),
  LabeledStatement: fail,
  BreakStatement: fail,
  ContinueStatement: fail,

  // TODO handle early return in if statement -- convert to else?
  IfStatement: (env, {test, consequent, alternate}) => statement(
    env,
    Pexp_ifthenelse(
      expression(jsItemToRe(Env.topLevel(env, false), test)),
      expression(jsItemToRe(Env.topLevel(env, false), consequent)),
      alternate ? expression(jsItemToRe(Env.topLevel(env, false), alternate)) : null
    )
  ),
  SwitchStatement: fail,
  SwitchCase: fail,

  /**
   * If the pattern is `throw new X(argOne, argTwo)` we should turn that into:
   *
   * raise (X argOne argTwo)
   *
   * Because chances are you have to turn the X into an exception anyway.
   */
  ThrowStatement: (env, {argument}) => {
    let thingToRaise =
        argument.type === 'NewExpression' &&
        argument.callee.type === 'Identifier' ?
      variant(env, argument.callee.name, argument.arguments) :
      {
        pexp_desc: jsItemToRe(env, argument),
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
  WhileStatement: (env, e) => {
    return statement(
      env,
      [
        'Pexp_while',
        expression(jsItemToRe(Env.topLevel(env, false), e.test)),
        expression(jsItemToRe(Env.topLevel(env, false), e.body))
      ]
    );
  },
  DoWhileStatement: fail,
  ForStatement: fail,
  ForInStatement: fail,
  ForOfStatement: fail,

  /**
   * TODO: Definitely make these recursive.
   */
  FunctionDeclaration: (env, e) => {
    let name = e.id.name;
    let fakeVariableDecl = functionDeclarationToVariableBinding(e);
    return jsItemToRe(env, fakeVariableDecl);
  },

  VariableDeclaration: (env, {declarations}) => env.isTopLevel ? [
    'Pstr_value',
    ['Nonrecursive'],
    declarations.map(jsItemToRe.bind(null, Env.topLevel(env, false))),
  ] : [
    'Pexp_let',
    ['Nonrecursive'],
    declarations.map(jsItemToRe.bind(null, Env.topLevel(env, false))),
    {
      pexp_desc: expNull,
      pexp_loc: noLoc,
      pexp_attributes: [],
    }
  ],
  VariableDeclarator: (env, {id, init, kind}) => ({
    pvb_pat: {
      ppat_desc: ['Ppat_var', {txt: id.name, loc: noLoc}],
      ppat_loc: noLoc,
      ppat_attributes: [],
    },
    pvb_expr: {
      pexp_desc:
        init ? jsItemToRe(Env.topLevel(env, false), init) :
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

  ArrayExpression: (env, e) => jsArrayToReasonList(Env.topLevel(env, false), e.elements),
  ObjectExpression: (env, e) => {
    let propertyToRecordField = (property) => {
      let keyName = property.key.type === 'Identifier' ?
        property.key.name :
        'unsupportedProperty';
      return [
        lidentLoc(keyName),
        expression(jsItemToRe(Env.topLevel(env, false), property.value))
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
  UnaryExpression: (env, e) => {
    return [
      'Pexp_apply',
      expression([
        'Pexp_ident',
        lidentLoc(jsOperatorToMlAst(e.operator))
      ]),
      applicationArgs(Env.topLevel(env, false), [e.argument])
    ];
  },
  UpdateExpression: (env, e) => {
    // x++ becomes x.contents = x.contents + 1
    let reasonOperationIdent =
      e.operator === '++' ?  lidentLoc('+') :
      e.operator == '--' ? lidentLoc('-') : null;
    if (reasonOperationIdent === null) {
      throw new Error('Cannot determine update identifier');
    }
    let operand = expression(jsItemToRe(Env.topLevel(env, false), e.argument));
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
  BinaryExpression: (env, {left, right, operator}) => jsItemToRe(
    env,
    {
      type: 'CallExpression',
      callee: {type: 'Identifier', name: jsOperatorToMlAst(operator)},
      arguments: [left, right]
    }
  ),
  AssignmentExpression: (env, {left, right, operator}) => operator === '=' ?
  (left.type === 'Identifier' ? [
    'Pexp_setfield',
    expression(Pexp_ident(lidentLoc(left.name))),
    lidentLoc('contents'),
    {pexp_desc: jsItemToRe(Env.topLevel(env, false), right), pexp_loc: noLoc, pexp_attributes: []},
  ] : (left.type === 'MemberExpression' && !left.computed ? [
    'Pexp_setfield',
    {pexp_desc: jsItemToRe(Env.topLevel(env, false), left.object), pexp_loc: noLoc, pexp_attributes: []},
    {txt: ['Lident', left.property.name], loc: noLoc},
    {pexp_desc: jsItemToRe(Env.topLevel(env, false), right), pexp_loc: noLoc, pexp_attributes: []},
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
      applicationArgs(Env.topLevel(env, false), [left.object, left.property, right])
  ] : fail("Cannot assign much"))) : (
    jsItemToRe(
      env,
      {
        type: 'CallExpression',
        callee: {type: 'Identifier', name: operator},
        arguments: [left, right]
      }
    )
  ),

  LogicalExpression: (env, {left, right, operator}) => jsItemToRe(
    env,
    {
      type: 'CallExpression',
      callee: {type: 'Identifier', name: jsOperatorToMlAst(operator)},
      arguments: [left, right]
    }
  ),
  SpreadElement: fail,
  MemberExpression: (env, {object, property, computed}) => computed ? [
    'Pexp_apply',
    {
      pexp_desc: [
        'Pexp_ident',
        {txt: ['Ldot', ['Lident', 'Array'], 'get'], loc: noLoc}
      ],
      pexp_loc: noLoc,
      pexp_attributes: []
    },
    applicationArgs(Env.topLevel(env, false), [object, property])
  ] : [
    'Pexp_field',
    {
      pexp_desc: jsItemToRe(Env.topLevel(env, false), object),
      pexp_loc: noLoc,
      pexp_attributes: [],
    },
    {txt: ['Lident', property.name], loc: noLoc}
  ],

  BindExpression: fail,

  ConditionalExpression: (env, e) => {
    return [
      'Pexp_match',
      expression(jsItemToRe(Env.topLevel(env, false), e.test)),
      [
        {
          "pc_lhs":{
            "ppat_desc":["Ppat_construct",{"txt":["Lident","true"],"loc":noLoc},null],
            "ppat_loc":noLoc,
            "ppat_attributes":[]
          },
          "pc_guard":null,
          "pc_rhs": expression(jsItemToRe(Env.topLevel(env, false), e.consequent))
        },
        {
          "pc_lhs":{
            "ppat_desc":["Ppat_construct",{"txt":["Lident","false"],"loc":noLoc},null],
            "ppat_loc":noLoc,
            "ppat_attributes":[]
          },
          "pc_guard":null,
          "pc_rhs": expression(jsItemToRe(Env.topLevel(env, false), e.alternate))
        }
      ]
    ]
  },

  CallExpression: (env, {callee, arguments}) => [
    'Pexp_apply',
    {
      pexp_desc: jsItemToRe(Env.topLevel(env, false), callee),
      pexp_loc: noLoc,
      pexp_attributes: []
    },
    arguments.length > 0 ? applicationArgs(Env.topLevel(env, false), arguments) : [["", expression(unit)]]
  ],

  NewExpression: (env, e) => {
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
      applicationArgs(Env.topLevel(env, false), e.arguments)
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


function jsItemToRe(env, item) {
  if (!jsByTag[item.type] || typeof jsByTag[item.type] !== 'function') {
    console.log('Unknown type', item.type)
  }
  if (!jsByTag[item.type]) {
    throw new Error("No Tag for:" + item.type + JSON.stringify(item))
  }
  return jsByTag[item.type](env, item)
}

module.exports = jsItemToRe;
