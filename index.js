'use strict';

const acorn = require('acorn');
const vm = require('vm');
const {
  setHiddenValue,
  decorated_private_symbol,
} = process.binding('util');
const wrapStart = require('module').wrapper[0];
const VMScript = vm.Script;

vm.Script = function Script(code, options) {
  let lastToken;
  let expectShittyASI = false;
  try {
    acorn.parse(code, {
      locations: true,
      onInsertedSemicolon() {
        expectShittyASI = true;
        throw new SyntaxError();
      },
      onToken(token) {
        lastToken = token;
      },
    });
  } catch (err) {
    if (expectShittyASI) {
      const def = 'evalmachine.<anonymous>';
      const filename = options ? options.filename ? options.filename : def : def;
      const { start, end: { line, column } } = lastToken.loc;
      const e = new SyntaxError('Unexpected end of input');
      let sliceStart = lastToken.start - start.column;
      let arrowLocation = column;
      code = code.slice(sliceStart, lastToken.end);
      if (code.startsWith(wrapStart)) {
        code = code.slice(wrapStart.length);
        arrowLocation -= wrapStart.length;
      }
      e.stack = `${filename}:${line}:${column}
${code}
${' '.repeat(arrowLocation)}^
${e.stack}`;
      setHiddenValue(e, decorated_private_symbol, true);
      throw e;
    }
  }
  return new VMScript(code, options);
};

vm.runInThisContext = function runInThisContext(code, options) {
  return new vm.Script(code, options).runInThisContext(options);
};

vm.runInNewContext = function runInNewContext(code, sandbox, options) {
  return new vm.Script(code, options).runInNewContext(sandbox, options);
};
