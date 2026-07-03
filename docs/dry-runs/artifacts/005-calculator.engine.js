/*
 * CalculatorEngine — DOM-free immediate-execution calculator state machine.
 * Windows 11 Standard calculator semantics (NO operator precedence).
 *
 * Public API:
 *   input(token) -> { display, expression, memoryActive, error }
 *   getView()    -> same view-model without mutating state
 *   reset()      -> full reset (clears memory too); returns view-model
 *
 * Single source of truth: this file is inlined verbatim into calculator.html.
 */
(function (global) {
  'use strict';

  // ---- numeric projection ------------------------------------------------
  // Round-half-away, <=16 significant digits, strip trailing zeros / dot.
  // Exponential notation when the decimal exponent > 15 or < -4.
  function project(v) {
    if (v === 0 || Object.is(v, -0)) return '0';
    if (!isFinite(v)) return v > 0 ? 'Overflow' : '-Overflow';

    var neg = v < 0;
    var a = Math.abs(v);

    // decimal exponent, corrected for floating point log10 error
    var exp = Math.floor(Math.log10(a));
    if (a < Math.pow(10, exp)) exp--;
    if (a >= Math.pow(10, exp + 1)) exp++;

    if (exp > 15 || exp < -4) {
      // exponential notation, 16 significant digits
      var mant = a / Math.pow(10, exp);
      var mdp = 15;
      var mr = Math.floor(mant * Math.pow(10, mdp) + 0.5) / Math.pow(10, mdp);
      if (mr >= 10) { mr = mr / 10; exp++; }
      var ms = mr.toFixed(mdp).replace(/0+$/, '').replace(/\.$/, '');
      return (neg ? '-' : '') + ms + 'e' + (exp >= 0 ? '+' : '-') + Math.abs(exp);
    }

    // fixed notation: round to 16 significant digits. Rounding on the decimal
    // representation (toPrecision) avoids the float error that a raw
    // multiply-by-10^dp introduces at the 16th digit (e.g. 0.1 + 0.2).
    var rounded = Number(a.toPrecision(16));
    var s = rounded.toString(); // plain decimal within this exponent range
    return (neg ? '-' : '') + s;
  }

  // significant-digit count of an entry string (for the 16-digit cap)
  function sigCount(s) {
    var t = s.replace('-', '').replace('.', '').replace(/^0+/, '');
    return t.length;
  }

  var OPS = { '+': 1, '-': 1, '×': 1, '÷': 1 };

  function CalculatorEngine() {
    this.reset();
  }

  CalculatorEngine.project = project; // exposed for tests/UI

  CalculatorEngine.prototype.reset = function () {
    this.accumulator = 0;
    this.pendingOp = null;
    this.entryBuffer = '';
    this.entryActive = false;
    this._entryValue = 0;
    this.lastOp = null;
    this.lastOperand = null;
    this.memory = null;
    this.error = null;
    this.justEvaluated = false;

    // expression rendering state
    this.committed = [];        // locked tokens, e.g. ['2','+','3','×']
    this._operandExpr = null;   // repr of current operand (unary/percent aware)
    this._exprTail = null;      // trailing segment shown before an op (unary)
    this._exprOverride = null;  // full expression string ('' == blank) for '='

    return this.view();
  };

  CalculatorEngine.prototype.currentValue = function () {
    if (this.entryActive) return this._entryValue;
    return this.accumulator;
  };

  CalculatorEngine.prototype._expression = function () {
    if (this._exprOverride !== null) return this._exprOverride;
    var parts = this.committed.slice();
    if (this._exprTail !== null) parts.push(this._exprTail);
    return parts.join(' ');
  };

  CalculatorEngine.prototype.view = function () {
    var display;
    if (this.error) display = this.error;
    else if (this.entryActive) display = this.entryBuffer;
    else display = project(this.accumulator);
    return {
      display: display,
      expression: this._expression(),
      memoryActive: this.memory !== null,
      error: this.error
    };
  };

  CalculatorEngine.prototype.getView = function () {
    return this.view();
  };

  // apply a binary operator; sets this.error on divide-by-zero
  CalculatorEngine.prototype.apply = function (op, a, b) {
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '×': return a * b;
      case '÷':
        if (b === 0) {
          this.error = (a === 0) ? 'Result is undefined' : 'Cannot divide by zero';
          return a;
        }
        return a / b;
    }
    return a;
  };

  CalculatorEngine.prototype.input = function (token) {
    // error latch: only CE and C respond while an error is showing
    if (this.error && token !== 'CE' && token !== 'C') return this.view();

    if (/^[0-9]$/.test(token) || token === '.') return this._digit(token);

    switch (token) {
      case '+':
      case '-':
      case '×':
      case '÷':
        return this._op(token);
      case '=': return this._equals();
      case '%': return this._percent();
      case 'neg': return this._neg();
      case 'sqrt': return this._unary('sqrt');
      case 'sqr': return this._unary('sqr');
      case 'recip': return this._unary('recip');
      case 'back': return this._back();
      case 'CE': return this._ce();
      case 'C': return this._c();
      case 'MS': return this._ms();
      case 'MR': return this._mr();
      case 'MC': return this._mc();
      case 'M+': return this._madd(1);
      case 'M-': return this._madd(-1);
    }
    return this.view();
  };

  CalculatorEngine.prototype._digit = function (tok) {
    if (!this.entryActive) {
      if (this.justEvaluated) { this.committed = []; }
      this._exprOverride = null;
      this._exprTail = null;
      this.entryActive = true;
      this.justEvaluated = false;
      this.entryBuffer = (tok === '.') ? '0.' : tok;
    } else {
      if (tok === '.') {
        if (this.entryBuffer.indexOf('.') >= 0) return this.view();
        this.entryBuffer += '.';
      } else {
        if (sigCount(this.entryBuffer) >= 16) return this.view();
        if (this.entryBuffer === '0') this.entryBuffer = tok;
        else this.entryBuffer += tok;
      }
    }
    this._operandExpr = this.entryBuffer;
    this._entryValue = parseFloat(this.entryBuffer) || 0;
    return this.view();
  };

  CalculatorEngine.prototype._op = function (sym) {
    var val, repr;

    if (this.entryActive) {
      val = this.currentValue();
      repr = (this._operandExpr !== null) ? this._operandExpr : project(val);
    } else if (this.justEvaluated) {
      // continue from a result: start a fresh expression
      this.committed = [];
      this._exprOverride = null;
      this.justEvaluated = false;
      this.pendingOp = null;
      val = this.accumulator;
      repr = project(val);
    } else {
      // operator pressed again without a new operand: just swap the operator
      this.pendingOp = sym;
      if (this.committed.length) this.committed[this.committed.length - 1] = sym;
      this._exprTail = null;
      this._exprOverride = null;
      return this.view();
    }

    if (this.pendingOp === null) {
      this.accumulator = val;
    } else {
      this.accumulator = this.apply(this.pendingOp, this.accumulator, val);
    }

    this.committed.push(repr);
    this.committed.push(sym);
    this.pendingOp = sym;
    this.entryActive = false;
    this._operandExpr = null;
    this._exprTail = null;
    this._exprOverride = null;
    this.justEvaluated = false;

    if (this.error) this._exprOverride = this.committed.join(' ');
    return this.view();
  };

  CalculatorEngine.prototype._equals = function () {
    if (this.pendingOp !== null) {
      var operand = this.currentValue();
      var repr = (this._operandExpr !== null) ? this._operandExpr : project(operand);
      var parts = this.committed.slice();
      parts.push(repr, '=');
      this._exprOverride = parts.join(' ');

      var r = this.apply(this.pendingOp, this.accumulator, operand);
      this.lastOp = this.pendingOp;
      this.lastOperand = operand;
      if (this.error === null) this.accumulator = r;

      this.pendingOp = null;
      this.committed = [];
      this.entryActive = false;
      this._operandExpr = null;
      this._exprTail = null;
      this.justEvaluated = true;
    } else if (this.lastOp !== null) {
      // repeated '=' : reuse lastOp/lastOperand and BLANK the expression
      var r2 = this.apply(this.lastOp, this.accumulator, this.lastOperand);
      if (this.error === null) this.accumulator = r2;
      this._exprOverride = '';
      this.entryActive = false;
      this._operandExpr = null;
      this._exprTail = null;
      this.justEvaluated = true;
    } else {
      // '=' with nothing pending: show "<value> ="
      var v = this.currentValue();
      var vr = (this._operandExpr !== null) ? this._operandExpr : project(v);
      this.accumulator = v;
      this._exprOverride = vr + ' =';
      this.entryActive = false;
      this._operandExpr = null;
      this._exprTail = null;
      this.justEvaluated = true;
    }
    return this.view();
  };

  CalculatorEngine.prototype._percent = function () {
    var e = this.currentValue();
    var acc = this.accumulator;
    var p;
    if (this.pendingOp === '+' || this.pendingOp === '-') {
      p = acc * e / 100;
    } else {
      // ×, ÷, or standalone
      p = e / 100;
    }
    this._entryValue = p;
    this.entryBuffer = project(p);
    this.entryActive = true;
    this._operandExpr = project(p);
    this._exprTail = null;
    this._exprOverride = null;
    this.justEvaluated = false;
    return this.view();
  };

  CalculatorEngine.prototype._neg = function () {
    if (this.entryActive) {
      if (this.entryBuffer.charAt(0) === '-') {
        this.entryBuffer = this.entryBuffer.slice(1);
      } else if (this.entryBuffer !== '0' && this.entryBuffer !== '') {
        this.entryBuffer = '-' + this.entryBuffer;
      }
      this._entryValue = parseFloat(this.entryBuffer) || 0;
      this._operandExpr = this.entryBuffer;
    } else {
      this.accumulator = -this.accumulator;
      this._entryValue = this.accumulator;
      this.entryBuffer = project(this.accumulator);
      this.entryActive = true;
      this._operandExpr = this.entryBuffer;
    }
    return this.view();
  };

  CalculatorEngine.prototype._unary = function (kind) {
    var v = this.currentValue();
    var base = (this._operandExpr !== null) ? this._operandExpr : project(v);
    var wrap, result;

    if (kind === 'sqrt') {
      wrap = '√(' + base + ')';
      if (v < 0) { this._exprTail = wrap; this._operandExpr = wrap; this.error = 'Invalid input'; return this.view(); }
      result = Math.sqrt(v);
    } else if (kind === 'sqr') {
      wrap = 'sqr(' + base + ')';
      result = v * v;
    } else { // recip
      wrap = '1/(' + base + ')';
      if (v === 0) { this._exprTail = wrap; this._operandExpr = wrap; this.error = 'Cannot divide by zero'; return this.view(); }
      result = 1 / v;
    }

    this._entryValue = result;
    this.entryBuffer = project(result);
    this.entryActive = true;
    this._operandExpr = wrap;
    this._exprTail = wrap;
    this._exprOverride = null;
    this.justEvaluated = false;
    return this.view();
  };

  CalculatorEngine.prototype._back = function () {
    if (!this.entryActive) return this.view();
    var s = this.entryBuffer.slice(0, -1);
    if (s === '' || s === '-') s = '0';
    this.entryBuffer = s;
    this._entryValue = parseFloat(s) || 0;
    this._operandExpr = s;
    return this.view();
  };

  CalculatorEngine.prototype._ce = function () {
    this.error = null;
    this.entryActive = true;
    this.entryBuffer = '0';
    this._entryValue = 0;
    this._operandExpr = null;
    this._exprTail = null;
    this._exprOverride = null;
    this.justEvaluated = false;
    return this.view();
  };

  CalculatorEngine.prototype._c = function () {
    var mem = this.memory;
    this.reset();
    this.memory = mem;
    return this.view();
  };

  CalculatorEngine.prototype._ms = function () {
    var v = this.currentValue();
    this.memory = v;
    this.accumulator = v;
    this.entryActive = false;
    this._operandExpr = null;
    this._exprTail = null;
    this.justEvaluated = true;
    return this.view();
  };

  CalculatorEngine.prototype._mr = function () {
    if (this.memory === null) return this.view();
    this._entryValue = this.memory;
    this.entryBuffer = project(this.memory);
    this.entryActive = true;
    this._operandExpr = project(this.memory);
    this._exprTail = null;
    this.justEvaluated = false;
    return this.view();
  };

  CalculatorEngine.prototype._mc = function () {
    this.memory = null;
    return this.view();
  };

  CalculatorEngine.prototype._madd = function (sign) {
    var v = this.currentValue();
    var base = (this.memory === null) ? 0 : this.memory;
    this.memory = base + sign * v;
    this.accumulator = v;
    this.entryActive = false;
    this._operandExpr = null;
    this._exprTail = null;
    this.justEvaluated = true;
    return this.view();
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CalculatorEngine;
  } else {
    global.CalculatorEngine = CalculatorEngine;
  }
})(typeof self !== 'undefined' ? self : this);
