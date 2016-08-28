#!/usr/bin/env node
'use strict'

const babylon = require('babylon')
const fs = require('fs')

const fname = process.argv[2]
const text = fs.readFileSync(fname).toString('utf8')
const ast = babylon.parse(text)
console.log(JSON.stringify(ast))
