'use strict';

const acorn = require('acorn');
const vm = require('vm');
const wrapStart = require('module').wrapper[0];

const {
  setHiddenValue,
  decorated_private_symbol: decoratedPrivateSymbol,
} = process.binding('util');

const {
  Script: VMScript,
  Module: VMModule,
} = vm;

function checkCode(code, filename, sourceType) {
  let lastToken;
  let expectShittyASI = false;
  try {
    acorn.parse(code, {
      sourceType,
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
      const { start, end: { line, column } } = lastToken.loc;
      const e = new SyntaxError('Unexpected end of input');
      const sliceStart = lastToken.start - start.column;
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
      setHiddenValue(e, decoratedPrivateSymbol, true);
      throw e;
    }
  }
}

vm.Script = function Script(code, options) {
  const s = new VMScript(code, options);
  const def = 'evalmachine.<anonymous>';
  checkCode(code, s.filename || (options && options.filename ? options.filename : def), 'script');
  return s;
};

vm.createScript = (...args) => new vm.Script(...args);

vm.runInThisContext = function runInThisContext(code, options) {
  return new vm.Script(code, options).runInThisContext(options);
};

vm.runInNewContext = function runInNewContext(code, sandbox, options) {
  return new vm.Script(code, options).runInNewContext(sandbox, options);
};

if (VMModule !== undefined) {
  vm.Module = function Module(source, options) {
    const m = new VMModule(source, options);
    checkCode(source, m.url, 'module');
    return m;
  };
}
