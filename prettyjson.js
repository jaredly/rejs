#!/usr/bin/env node
'use strict'

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

readStdin(text => {
  console.log(JSON.stringify(JSON.parse(text), null, 2))
})

