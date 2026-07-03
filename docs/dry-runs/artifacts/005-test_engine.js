'use strict';
var CalculatorEngine = require('../src/calculator.engine.js');

// Multi-char tokens appear space-delimited as their own chunk.
var MULTI = {
  sqrt: 1, sqr: 1, recip: 1, neg: 1, back: 1,
  CE: 1, C: 1, MS: 1, MR: 1, MC: 1, 'M+': 1, 'M-': 1
};

function tokenize(seq) {
  var out = [];
  var chunks = seq.split(/\s+/).filter(function (c) { return c.length; });
  chunks.forEach(function (chunk) {
    if (MULTI[chunk]) { out.push(chunk); return; }
    for (var i = 0; i < chunk.length; i++) out.push(chunk[i]);
  });
  return out;
}

// seq | expected display | expected expression ("" == blank)
var VECTORS = [
  ['7+3=', '10', '7 + 3 ='],
  ['9-4=', '5', '9 - 4 ='],
  ['6×7=', '42', '6 × 7 ='],
  ['8÷2=', '4', '8 ÷ 2 ='],
  ['2+3×4=', '20', '2 + 3 × 4 ='],
  ['2+3+4=', '9', '2 + 3 + 4 ='],
  ['5+2==', '9', ''],
  ['100+10%=', '110', '100 + 10 ='],
  ['100-10%=', '90', '100 - 10 ='],
  ['200×10%=', '20', '200 × 0.1 ='],
  ['100÷10%=', '1000', '100 ÷ 0.1 ='],
  ['10%', '0.1', ''],
  ['0.5+0.5=', '1', '0.5 + 0.5 ='],
  ['0.1+0.2=', '0.3', '0.1 + 0.2 ='],
  ['25 sqrt', '5', '√(25)'],
  ['5 sqr', '25', 'sqr(5)'],
  ['4 recip', '0.25', '1/(4)'],
  ['5 neg', '-5', ''],
  ['9 neg sqrt', 'Invalid input', '√(-9)'],
  ['5÷0=', 'Cannot divide by zero', '5 ÷ 0 ='],
  ['0÷0=', 'Result is undefined', '0 ÷ 0 ='],
  ['5÷0= C 7+1=', '8', '7 + 1 ='],
  ['1 2 3 back', '12', ''],
  ['5+9 CE 4=', '9', '5 + 4 ='],
  ['5+9 C', '0', ''],
  ['5 MS 3+ MR =', '8', '3 + 5 ='],
  ['10 MS 5 M+ MR', '15', ''],
  ['8 MS MC MR', '8', '']
];

var pass = 0, fail = 0;
VECTORS.forEach(function (vec) {
  var seq = vec[0], expDisplay = vec[1], expExpr = vec[2];
  var eng = new CalculatorEngine();
  var view;
  tokenize(seq).forEach(function (t) { view = eng.input(t); });
  if (!view) view = eng.getView();

  var ok = view.display === expDisplay && view.expression === expExpr;
  if (ok) {
    pass++;
  } else {
    fail++;
    console.log('FAIL: "' + seq + '"');
    console.log('   display : got ' + JSON.stringify(view.display) + ' want ' + JSON.stringify(expDisplay));
    console.log('   express : got ' + JSON.stringify(view.expression) + ' want ' + JSON.stringify(expExpr));
  }
});

console.log('\n' + pass + '/' + (pass + fail) + ' golden vectors passed.');
process.exit(fail === 0 ? 0 : 1);
