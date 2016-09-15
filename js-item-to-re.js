const {noPos, noLoc, patNull, expNull} = require('./consts.js')

let fail = null;

let arraysAsLists = true;


let List = {
  create: () => null,
  cons: (hd, tl) => ({hd: hd, tl: tl})
};

let Env = {
  init: () => ({
    isTopLevel: true,
    typeEnv: List.create()
  }),
  topLevel: (env, isTopLevel) => {
    var next = {};
    var keys = Object.keys(env);
    keys.forEach((k) => {
      next[k] = env[k];
    });
    next.isTopLevel = !!isTopLevel;
    return next;
  }
};

var lidentLoc = (name) => {
  return {txt: ['Lident', name], loc: noLoc};
};

var stringLoc = (str) => {
  return {txt: str, loc: noLoc};
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
    (exprDesc),
    lidentLoc
  ];
};

let Upto = ["Upto"];
let Downto = ["Downto"];
let Ppat_var = (stringLoc) => {
  return ["Ppat_var", stringLoc];
};

let Pexp_for = (pat, init, end, direction, body) => {
  return ["Pexp_for", pat, init, end, direction, body]
};

let createForLoop = (counterName, initExpr, endExpr, direction, bodyExpr) => {
  return Pexp_for(
    {"ppat_desc": Ppat_var(stringLoc(counterName)),"ppat_loc":noLoc,"ppat_attributes":[]},
    initExpr,
    endExpr,
    direction,
    bodyExpr
  )
};


let expression = (exprDesc) => ({
  pexp_desc: exprDesc,
  pexp_loc: noLoc,
  pexp_attributes: []
});

let Pexp_ifthenelse = (test, consequent, alternate) => [
  'Pexp_ifthenelse',
  (test),
  (consequent),
  alternate ? (alternate) : null,
]

let Pexp_tuple = (lst) => ['Pexp_tuple', lst];

let nil = expression(Pexp_construct(lidentLoc('[]'), null));
let unit = expression(Pexp_construct(lidentLoc('()'), null));

let cons = (hd, tl) => {
  return expression(
    Pexp_construct(
      lidentLoc('::'),
      expression(Pexp_tuple([hd, tl]))
    )
  );
};


let ArrList = {
  length: (lst) => lst.length,
  hd: (lst) => lst[0],
  tl: (lst) => {
    return lst.length === 0 ?
      fail('Cannot take tail of zero len list') :
      lst.slice(1);
  }
};

let jsArrayToReasonList = (env, lst) => {
  return (ArrList.length(lst) == 0) ? nil :
    cons(
      compile(env, ArrList.hd(lst)),
      (jsArrayToReasonList(env, ArrList.tl(lst)))
    );
};

let onlyIfNotReturned = (e) => {
  return expression(Pexp_ifthenelse(
    expression([
      "Pexp_apply",
      expression(Pexp_ident(lidentLoc(jsOperatorToMlMap("===")))),
      [
        ["", expression(["Pexp_field", expression(Pexp_ident(lidentLoc("retVal"))), lidentLoc("contents")])],
        ["", expression(Pexp_construct(lidentLoc("None"), null))]
      ]
    ]),
    e,
    expression(Pexp_field(expression(Pexp_ident(lidentLoc("retVal"))), lidentLoc("contents")))
  ));
};

let plusOrMinusOne = (plusOrMinusToken, e) => {
  return expression([
    "Pexp_apply",
    expression(Pexp_ident(lidentLoc(plusOrMinusToken))),
    [
      ["", e],
      ["", expression(["Pexp_constant", ["Const_int",1]])]
    ]
  ]);
};


function potentiallyStructureEval(env, body) {
  return env.isTopLevel ? [
    'Pstr_eval',
    (body),
    [] // attributes
  ] : body
}

function funShell(arg, body) {
  return [
    'Pexp_fun',
    '',
    null,
    {
      ppat_desc: arg,
      ppat_loc: noLoc,
      ppat_attributes: [],
    },
    (body)
  ];
}

var functionToReason = (env, {body, params}) => {
  let bod = compile(env, body);
  if (!params.length) {
    return expression(funShell(patNull, bod))
  }
  for (let i=params.length - 1; i>=0; i--) {
    bod = expression(funShell(['Ppat_var', {txt: params[i].name, loc: noLoc}], bod))
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

var tuple = (env, args) => expression([
  'Pexp_tuple',
  args.map((arg) => (compile(env, arg)))
]);

var variant = (env, name, args) => {
  var variantName = name.charAt(0).toUpperCase() + name.substr(1);
  return expression(['Pexp_construct', {txt: ['Lident', variantName], loc: noLoc}, tuple(env, args)]);
}

var applicationArgs = (env, args) =>
    args.map(arg => [
      "",
      (compile(env, arg))
    ]);

var jsByTag = {
  Identifier: (env, {name}) => expression([
    'Pexp_ident',
    {
      txt: ['Lident', name],
      loc: noLoc
    }
  ]),

  NullLiteral: (env) => expression(['Pexp_construct', {txt: ['Lident', '()'], loc: noLoc}, null]),
  StringLiteral: (env, {value}) => expression(['Pexp_constant', ['Const_string', value, null]]),
  NumericLiteral: (env, {value, extra}) => {
    let raw = extra.raw;
    if (raw.indexOf('.') !== -1) {
      return expression(['Pexp_constant', ['Const_float', raw]]);
    } else {
      return expression(['Pexp_constant', ['Const_int', value]]);
    }
  },
  RegexpLiteral: fail,
  BooleanLiteral: (env, e) => {
    return jsByTag.Identifier(env, {name: '' + e.value});
  },

  ExpressionStatement: (env, itm) => {
    let expr = itm.expression;
    return (potentiallyStructureEval(env, compile(env, expr)))
  }
  ,

  BlockStatement: (env, {body}) => {
    if (!body.length) return expNull;
    let res = compile(env, body[body.length - 1])
    for (let i=body.length - 2; i>=0; i--) {
      if (body[i].type === 'VariableDeclaration' || body[i].type === 'FunctionDeclaration') {
        let normalizedBody = (body[i].type === 'FunctionDeclaration') ?
          functionDeclarationToVariableBinding(body[i]) :
          body[i];
        res = expression([
          'Pexp_let',
          ['Nonrecursive'],
          normalizedBody.declarations.map(compile.bind(null, env)),
          (res)
        ])
      } else {
        res = expression([
          'Pexp_sequence',
          (compile(env, body[i])),
          (res)
        ])
      }
    }

    return res
  },

  EmptyStatement: fail,
  DebuggerStatement: fail,
  WithStatement: fail,

  // TODO do some control flow analysis to make this actually be the final
  // potentiallyStructureEval in a function
  ReturnStatement: (env, {argument}) => compile(env, argument),
  LabeledStatement: fail,
  BreakStatement: fail,
  ContinueStatement: fail,

  // TODO handle early return in if statement -- convert to else?
  IfStatement: (env, {test, consequent, alternate}) => potentiallyStructureEval(
    env,
    expression(
      Pexp_ifthenelse(
        (compile(Env.topLevel(env, false), test)),
        (compile(Env.topLevel(env, false), consequent)),
        alternate ? (compile(Env.topLevel(env, false), alternate)) : null
      )
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
      (compile(env, argument));
    return expression([
      'Pexp_apply',
      expression(['Pexp_ident', lidentLoc('raise')]),
      [
        ["", thingToRaise]
      ]
    ]);
  },
  TryStatement: fail,
  CatchClause: fail,
  WhileStatement: (env, e) => {
    return potentiallyStructureEval(
      env,
      expression([
        'Pexp_while',
        (compile(Env.topLevel(env, false), e.test)),
        (compile(Env.topLevel(env, false), e.body))
      ])
    );
  },
  DoWhileStatement: fail,
  ForStatement: (env, e) => {
    let init = e.init;
    let test = e.test;
    let update = e.update;
    let identifierAndInit =
      (init.type === 'VariableDeclaration' && init.declarations.length === 1 && init.declarations[0].type === 'VariableDeclarator') ?
        {name: init.declarations[0].id.name, init: init.declarations[0].init} :
      (init.type === 'AssignmentExpression') ?
        {name: init.left.name, init: init.right} :
      null;
    if ((identifierAndInit === null)) {
      throw new Error("Cannot transform for loop that doesn't conform to simple loop pattern");
    };
    let unaryUpdate =
      identifierAndInit !== null &&
      update.type === 'UpdateExpression' && update.argument.type === 'Identifier' &&
        update.argument.name === identifierAndInit.name ? (
          update.operator === '++' ? '++' :
          update.operator === '--' ? '--' :
          null
        ) : null;
    let assignmentUpdate =
      identifierAndInit !== null &&
      update.type === 'AssignmentExpression' &&
        update.operator === '=' &&
        update.left.type === 'Identifier' &&
        update.left.name === identifierAndInit.name &&
        update.right.type === 'BinaryExpression' &&
        update.right.left.type === 'Identifier' &&
        update.right.left.name === identifierAndInit.name &&
        update.right.right.type === 'NumericLiteral' &&
        update.right.right.value === 1 ?
        (
          update.right.operator === '+' ? '++' :
          update.right.operator === '-' ? '--' :
          null
        ) : null;
    let endBoundary =
      identifierAndInit !== null &&
      test.type === 'BinaryExpression' &&
        test.left.type === 'Identifier' && test.left.name === identifierAndInit.name ?
        {op: test.operator, e: test.right} : null;

    if ((unaryUpdate == null && assignmentUpdate == null) || endBoundary === null) {
      let str = (unaryUpdate == null) + ' - ' + (assignmentUpdate == null) + ' - ' +  endBoundary === null;
      throw new Error(assignmentUpdate);
    }
    let updateOp = assignmentUpdate || unaryUpdate;
    let initExpr = compile(Env.topLevel(env, false), identifierAndInit.init);
    let tentativeEndExpr = compile(Env.topLevel(env, false), endBoundary.e);
    let endDirectionAndExpression =
      (endBoundary.op === '<=' && updateOp == '++') ?
        {dir: Upto, e: tentativeEndExpr} :
      (endBoundary.op === '<') && updateOp === '++' ?
        {dir: Upto, e: plusOrMinusOne('-', tentativeEndExpr)} :
      (endBoundary.op === '>=') && updateOp === '--' ?
        {dir: Downto, e: tentativeEndExpr} :
      (endBoundary.op === '>') && updateOp === '--' ?
        {dir: Downto, e: plusOrMinusOne('+', tentativeEndExpr)}
       : null;
    if (endDirectionAndExpression === null) {
      throw new Error("This for loop is too fancy. Can't compile it.");
    }
    return potentiallyStructureEval(
      env,
      expression(
        createForLoop(
          identifierAndInit.name,
          initExpr,
          endDirectionAndExpression.e,
          endDirectionAndExpression.dir,
          compile(Env.topLevel(env, false), e.body)
        )
      )
    );
  },
  ForInStatement: fail,
  ForOfStatement: fail,

  /**
   * TODO: Definitely make these recursive.
   */
  FunctionDeclaration: (env, e) => {
    let name = e.id.name;
    let fakeVariableDecl = functionDeclarationToVariableBinding(e);
    return compile(env, fakeVariableDecl);
  },

  VariableDeclaration: (env, {declarations}) => env.isTopLevel ? ([
    'Pstr_value',
    ['Nonrecursive'],
    declarations.map(compile.bind(null, Env.topLevel(env, false))),
  ]) : expression([
    'Pexp_let',
    ['Nonrecursive'],
    declarations.map(compile.bind(null, Env.topLevel(env, false))),
    (expNull)
  ]),
  VariableDeclarator: (env, {id, init, kind}) => ({
    pvb_pat: {
      ppat_desc: ['Ppat_var', {txt: id.name, loc: noLoc}],
      ppat_loc: noLoc,
      ppat_attributes: [],
    },
    pvb_expr: (
      init ? compile(Env.topLevel(env, false), init) :
      expression(['Pexp_construct', {txt: ['Lident', 'None'], loc: noLoc}, null])
    ),
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
        (compile(Env.topLevel(env, false), property.value))
      ];
    };
    return expression([
      'Pexp_record',
      e.properties.map(propertyToRecordField),
      null /* The "with" portion */
    ]);
  },
  ObjectMember: fail,
  ObjectProperty: fail,
  ObjectMethod: fail,
  RestProperty: fail,
  SpreadProperty: fail,
  FunctionExpression: functionToReason,
  UnaryExpression: (env, e) => {
    return expression([
      'Pexp_apply',
      expression([
        'Pexp_ident',
        lidentLoc(jsOperatorToMlAst(e.operator))
      ]),
      applicationArgs(Env.topLevel(env, false), [e.argument])
    ]);
  },
  UpdateExpression: (env, e) => {
    // x++ becomes x.contents = x.contents + 1
    let reasonOperationIdent =
      e.operator === '++' ?  lidentLoc('+') :
      e.operator == '--' ? lidentLoc('-') : null;
    if (reasonOperationIdent === null) {
      throw new Error('Cannot determine update identifier');
    }
    let operand = (compile(Env.topLevel(env, false), e.argument));
    return expression([
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
    ]);
  },
  BinaryExpression: (env, {left, right, operator}) => compile(
    env,
    {
      type: 'CallExpression',
      callee: {type: 'Identifier', name: jsOperatorToMlAst(operator)},
      arguments: [left, right]
    }
  ),
  AssignmentExpression: (env, {left, right, operator}) => operator === '=' ?
  (left.type === 'Identifier' ? expression([
    'Pexp_setfield',
    expression(Pexp_ident(lidentLoc(left.name))),
    lidentLoc('contents'),
    (compile(Env.topLevel(env, false), right)),
  ]) : (left.type === 'MemberExpression' && !left.computed ? expression([
    'Pexp_setfield',
    (compile(Env.topLevel(env, false), left.object)),
    {txt: ['Lident', left.property.name], loc: noLoc},
    (compile(Env.topLevel(env, false), right)),
  ]) : (left.type === 'MemberExpression' && left.computed) ? expression([
    /* TODO: Perform basic type inference to determine if this is an array
     * update or a hash table update */
      'Pexp_apply',
      expression(['Pexp_ident', {txt: ['Ldot', ['Lident', 'Array'], 'set'], loc: noLoc}]),
      applicationArgs(Env.topLevel(env, false), [left.object, left.property, right])
  ]) : fail("Cannot assign much"))) : (
    compile(
      env,
      {
        type: 'CallExpression',
        callee: {type: 'Identifier', name: operator},
        arguments: [left, right]
      }
    )
  ),

  LogicalExpression: (env, {left, right, operator}) => compile(
    env,
    {
      type: 'CallExpression',
      callee: {type: 'Identifier', name: jsOperatorToMlAst(operator)},
      arguments: [left, right]
    }
  ),
  SpreadElement: fail,
  MemberExpression: (env, {object, property, computed}) => computed ? expression([
    'Pexp_apply',
    expression([
      'Pexp_ident',
      {txt: ['Ldot', ['Lident', 'Array'], 'get'], loc: noLoc}
    ]),
    applicationArgs(Env.topLevel(env, false), [object, property])
  ]) : expression([
    'Pexp_field',
    (compile(Env.topLevel(env, false), object)),
    {txt: ['Lident', property.name], loc: noLoc}
  ]),

  BindExpression: fail,

  ConditionalExpression: (env, e) => {
    return expression([
      'Pexp_match',
      (compile(Env.topLevel(env, false), e.test)),
      [
        {
          "pc_lhs":{
            "ppat_desc":["Ppat_construct",{"txt":["Lident","true"],"loc":noLoc},null],
            "ppat_loc":noLoc,
            "ppat_attributes":[]
          },
          "pc_guard":null,
          "pc_rhs": (compile(Env.topLevel(env, false), e.consequent))
        },
        {
          "pc_lhs":{
            "ppat_desc":["Ppat_construct",{"txt":["Lident","false"],"loc":noLoc},null],
            "ppat_loc":noLoc,
            "ppat_attributes":[]
          },
          "pc_guard":null,
          "pc_rhs": (compile(Env.topLevel(env, false), e.alternate))
        }
      ]
    ])
  },

  CallExpression: (env, {callee, arguments}) => expression([
    'Pexp_apply',
    (compile(Env.topLevel(env, false), callee)),
    arguments.length > 0 ? applicationArgs(Env.topLevel(env, false), arguments) : [["", (unit)]]
  ]),

  NewExpression: (env, e) => {
    let calleeName =
      e.callee.type ===
        'Identifier' ? e.callee.name.charAt(0).toLowerCase() +
        e.callee.name.substr(1) :
      'todoCannotSupportClassesThatAreNotIdentifiers';
    return expression([
      'Pexp_apply',
      expression([
        'Pexp_new',
        {txt: ['Lident', calleeName], loc: noLoc}
      ]),
      applicationArgs(Env.topLevel(env, false), e.arguments)
    ]);
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

function compile(env, item) {
  if (!item) {
    throw new Error ('Item is not truthy ' + JSON.stringify(item));
  }
  if (!jsByTag[item.type] || typeof jsByTag[item.type] !== 'function') {
    throw new Error("No Tag for:" + item.type + JSON.stringify(item))
  }
  let reasonAst = jsByTag[item.type](env, item);
  let res = {
    reasonAst: reasonAst,
    returnsEarly: false,
    inferredType: null,
    refinedEnvironment: env
  }
  return res.reasonAst;
}

exports.compile = compile;
