const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

class Parser {
  constructor(input, xValue) {
    this.tokens = this.tokenize(String(input ?? ''));
    this.current = 0;
    this.xValue = xValue;
  }

  tokenize(input) {
    const tokens = [];
    let i = 0;

    const isDigit = (ch) => ch >= '0' && ch <= '9';
    const isAlpha = (ch) => /[a-zA-Z_]/.test(ch);

    while (i < input.length) {
      const ch = input[i];

      if (/\s/.test(ch)) {
        i += 1;
        continue;
      }

      if (isDigit(ch) || (ch === '.' && isDigit(input[i + 1]))) {
        const start = i;
        i += 1;

        while (i < input.length && (isDigit(input[i]) || input[i] === '.')) i += 1;

        if (i < input.length && /[eE]/.test(input[i])) {
          let j = i + 1;
          if (input[j] === '+' || input[j] === '-') j += 1;
          const expStart = j;
          while (j < input.length && isDigit(input[j])) j += 1;
          if (j > expStart) i = j;
        }

        tokens.push({ type: 'number', value: input.slice(start, i) });
        continue;
      }

      if (isAlpha(ch)) {
        const start = i;
        i += 1;
        while (i < input.length && /[a-zA-Z0-9_]/.test(input[i])) i += 1;
        tokens.push({ type: 'identifier', value: input.slice(start, i) });
        continue;
      }

      if ('+-*/^(),'.includes(ch)) {
        tokens.push({ type: ch, value: ch });
        i += 1;
        continue;
      }

      throw new Error(`Karakter tidak valid: '${ch}'`);
    }

    return tokens;
  }

  peek() {
    return this.tokens[this.current] ?? null;
  }

  next() {
    return this.tokens[this.current++] ?? null;
  }

  match(type) {
    const token = this.peek();
    if (token && token.type === type) {
      this.current += 1;
      return true;
    }
    return false;
  }

  expect(type, message) {
    const token = this.next();
    if (!token || token.type !== type) throw new Error(message);
    return token;
  }

  parseExpression() {
    let value = this.parseTerm();
    while (true) {
      if (this.match('+')) value += this.parseTerm();
      else if (this.match('-')) value -= this.parseTerm();
      else break;
    }
    return value;
  }

  parseTerm() {
    let value = this.parsePower();
    while (true) {
      if (this.match('*')) value *= this.parsePower();
      else if (this.match('/')) value /= this.parsePower();
      else break;
    }
    return value;
  }

  parsePower() {
    let value = this.parseUnary();
    if (this.match('^')) {
      const exponent = this.parsePower();
      value = Math.pow(value, exponent);
    }
    return value;
  }

  parseUnary() {
    if (this.match('+')) return this.parseUnary();
    if (this.match('-')) return -this.parseUnary();
    return this.parsePrimary();
  }

  parsePrimary() {
    const token = this.peek();
    if (!token) throw new Error('Ekspresi fungsi tidak lengkap.');

    if (this.match('(')) {
      const value = this.parseExpression();
      this.expect(')', 'Tanda kurung tidak seimbang.');
      return value;
    }

    if (token.type === 'number') {
      this.next();
      const value = Number(token.value);
      if (!Number.isFinite(value)) throw new Error('Angka tidak valid.');
      return value;
    }

    if (token.type === 'identifier') {
      const name = token.value.toLowerCase();
      this.next();

      if (name === 'x') return this.xValue;
      if (name === 'pi') return Math.PI;
      if (name === 'e') return Math.E;

      if (!this.match('(')) {
        throw new Error(`Identitas tidak dikenali: ${token.value}`);
      }

      const args = [];
      if (!this.match(')')) {
        while (true) {
          args.push(this.parseExpression());
          if (this.match(',')) continue;
          this.expect(')', 'Tanda kurung fungsi tidak seimbang.');
          break;
        }
      }

      return this.applyFunction(name, args);
    }

    throw new Error(`Token tidak valid: ${token.type}`);
  }

  applyFunction(name, args) {
    const unary = (fnName, fn) => {
      if (args.length !== 1) throw new Error(`${fnName} membutuhkan 1 argumen.`);
      return fn(args[0]);
    };

    const binary = (fnName, fn) => {
      if (args.length !== 2) throw new Error(`${fnName} membutuhkan 2 argumen.`);
      return fn(args[0], args[1]);
    };

    switch (name) {
      case 'sin': return unary('sin', Math.sin);
      case 'cos': return unary('cos', Math.cos);
      case 'tan': return unary('tan', Math.tan);
      case 'asin': return unary('asin', Math.asin);
      case 'acos': return unary('acos', Math.acos);
      case 'atan': return unary('atan', Math.atan);
      case 'sinh': return unary('sinh', Math.sinh);
      case 'cosh': return unary('cosh', Math.cosh);
      case 'tanh': return unary('tanh', Math.tanh);
      case 'sqrt': return unary('sqrt', Math.sqrt);
      case 'abs': return unary('abs', Math.abs);
      case 'exp': return unary('exp', Math.exp);
      case 'log': return unary('log', Math.log10 ? Math.log10 : (x) => Math.log(x) / Math.LN10);
      case 'ln': return unary('ln', Math.log);
      case 'floor': return unary('floor', Math.floor);
      case 'ceil': return unary('ceil', Math.ceil);
      case 'round': return unary('round', Math.round);
      case 'min': return binary('min', Math.min);
      case 'max': return binary('max', Math.max);
      default:
        throw new Error(`Fungsi tidak dikenali: ${name}`);
    }
  }
}

function evaluateExpression(expr, x) {
  const parser = new Parser(expr, x);
  const value = parser.parseExpression();

  if (parser.current < parser.tokens.length) {
    const token = parser.peek();
    throw new Error(`Token tidak terduga: ${token.value}`);
  }

  if (!Number.isFinite(value)) {
    throw new Error('Hasil evaluasi fungsi tidak valid.');
  }

  return value;
}

function createFunction(expr) {
  if (typeof expr !== 'string' || !expr.trim()) {
    throw new Error('Fungsi f(x) wajib diisi.');
  }

  return (x) => evaluateExpression(expr, x);
}

function createResultBase(method, tol, fx, a, b) {
  return {
    method,
    methodLabel: method === 'bisection' ? 'Metode Bagi Dua' : 'Metode Regula Falsi',
    tolerance: tol,
    fx,
    a,
    b,
  };
}

function computeBisection(f, a0, b0, tol, maxIter, fx) {
  let a = a0;
  let b = b0;
  let fa = f(a);
  let fb = f(b);

  if (!Number.isFinite(fa) || !Number.isFinite(fb)) {
    throw new Error('Fungsi tidak valid pada nilai a atau b.');
  }

  if (Math.abs(fa) <= tol) {
    return {
      ...createResultBase('bisection', tol, fx, a0, b0),
      root: a,
      converged: true,
      message: 'Akar ditemukan pada batas bawah interval.',
      iterations: [{
        iter: 0,
        a,
        b,
        c: a,
        fa,
        fb,
        fc: fa,
        error: 0,
        width: 0,
        interval: 0,
        status: true,
      }],
    };
  }

  if (Math.abs(fb) <= tol) {
    return {
      ...createResultBase('bisection', tol, fx, a0, b0),
      root: b,
      converged: true,
      message: 'Akar ditemukan pada batas atas interval.',
      iterations: [{
        iter: 0,
        a,
        b,
        c: b,
        fa,
        fb,
        fc: fb,
        error: 0,
        width: 0,
        interval: 0,
        status: true,
      }],
    };
  }

  if (fa * fb > 0) {
    throw new Error('Metode bagi dua membutuhkan f(a) dan f(b) dengan tanda berbeda.');
  }

  const iterations = [];
  let c = a;
  let prevC = null; // Menambahkan variabel prevC sama seperti Regula Falsi

  for (let i = 0; i <= maxIter; i += 1) {
    c = (a + b) / 2;
    const fc = f(c);

    if (!Number.isFinite(fc)) {
      throw new Error(`Nilai fungsi tidak valid pada iterasi ${i}.`);
    }

    let intervalWidth;
    let newInterval;

    if (fa * fc < 0) {
      intervalWidth = Math.abs(c - a);
      newInterval = "[a,c]";
    } else {
      intervalWidth = Math.abs(b - c);
      newInterval = "[c,b]";
    }

    // Mengubah penentuan status konvergen meniru Regula Falsi
    const convergenceError = prevC === null ? null : Math.abs(c - prevC);
    const converged = prevC !== null && convergenceError < tol;

    iterations.push({
      iter: i,
      a,
      b,
      c,
      fa,
      fb,
      fc,
      newInterval,
      error: intervalWidth, // Tetap menggunakan lebar interval untuk kolom tabel
      width: intervalWidth,
      interval: intervalWidth,
      status: converged,
      convergenceError,
    });

    if (converged) {
      return {
        ...createResultBase('bisection', tol, fx, a0, b0),
        root: c,
        converged: true,
        message: `Konvergen pada iterasi ${i}.`,
        iterations,
      };
    }

    if (fa * fc < 0) {
      b = c;
      fb = fc;
    } else {
      a = c;
      fa = fc;
    }

    prevC = c; // Menyimpan nilai c saat ini untuk dievaluasi di iterasi berikutnya
  }

  return {
    ...createResultBase('bisection', tol, fx, a0, b0),
    root: c,
    converged: false,
    message: 'Mencapai maksimum iterasi sebelum memenuhi toleransi.',
    iterations,
  };
}

function computeRegulaFalsi(f, a0, b0, tol, maxIter, fx) {
  let a = a0;
  let b = b0;
  let fa = f(a);
  let fb = f(b);

  if (!Number.isFinite(fa) || !Number.isFinite(fb)) {
    throw new Error('Fungsi tidak valid pada nilai a atau b.');
  }

  if (Math.abs(fa) <= tol) {
    return {
      ...createResultBase('regula', tol, fx, a0, b0),
      root: a,
      converged: true,
      message: 'Akar ditemukan pada batas bawah interval.',
      iterations: [{
        iter: 0,
        a,
        b,
        c: a,
        fa,
        fb,
        fc: fa,
        error: 0,
        width: 0,
        interval: 0,
        status: true,
      }],
    };
  }

  if (Math.abs(fb) <= tol) {
    return {
      ...createResultBase('regula', tol, fx, a0, b0),
      root: b,
      converged: true,
      message: 'Akar ditemukan pada batas atas interval.',
      iterations: [{
        iter: 0,
        a,
        b,
        c: b,
        fa,
        fb,
        fc: fb,
        error: 0,
        width: 0,
        interval: 0,
        status: true,
      }],
    };
  }

  if (fa * fb > 0) {
    throw new Error('Regula falsi membutuhkan f(a) dan f(b) dengan tanda berbeda.');
  }

  const iterations = [];
  let c = a;
  let prevC = null;

  for (let i = 0; i <= maxIter; i += 1) {
    const denom = fb - fa;

    if (denom === 0) {
      throw new Error('Pembagi nol terjadi pada rumus regula falsi.');
    }

    c = (a * fb - b * fa) / denom;
    const fc = f(c);

    if (!Number.isFinite(fc)) {
      throw new Error(`Nilai fungsi tidak valid pada iterasi ${i}.`);
    }

    /*
      Lebar interval dibuat sama seperti Excel:
      Jika selang baru [a, c], maka lebar = |c - a|
      Jika selang baru [c, b], maka lebar = |b - c|
    */
    let intervalWidth;
    let newInterval;

    if (fa * fc < 0) {
      intervalWidth = Math.abs(c - a);
      newInterval = "[a,c]";
    } else {
      intervalWidth = Math.abs(b - c);
      newInterval = "[c,b]";
    }

    /*
      Status TRUE/FALSE mengikuti Excel:
      TRUE jika |c sekarang - c sebelumnya| < toleransi
    */
    const convergenceError = prevC === null ? null : Math.abs(c - prevC);
    const converged = prevC !== null && convergenceError < tol;

    iterations.push({
      iter: i,
      a,
      b,
      c,
      fa,
      fb,
      fc,
      newInterval,
      // Kolom yang ditampilkan sebagai "Lebar Interval"
      error: intervalWidth,
      width: intervalWidth,
      interval: intervalWidth,

      // Status untuk TRUE/FALSE dan pewarnaan baris
      status: converged,

      // Disimpan kalau nanti ingin ditampilkan sebagai galat konvergensi
      convergenceError,
    });

    if (converged) {
      return {
        ...createResultBase('regula', tol, fx, a0, b0),
        root: c,
        converged: true,
        message: `Konvergen pada iterasi ${i}.`,
        iterations,
      };
    }

    if (fa * fc < 0) {
      b = c;
      fb = fc;
    } else {
      a = c;
      fa = fc;
    }

    prevC = c;
  }

  return {
    ...createResultBase('regula', tol, fx, a0, b0),
    root: c,
    converged: false,
    message: 'Mencapai maksimum iterasi sebelum memenuhi toleransi.',
    iterations,
  };
}

app.post('/api/calculate', (req, res) => {
  try {
    const { fx, a, b, tolerance, maxIterations, method } = req.body;

    if (!fx || a === undefined || b === undefined || tolerance === undefined || maxIterations === undefined || !method) {
      return res.status(400).json({ error: 'Semua input wajib diisi.' });
    }

    const av = Number(a);
    const bv = Number(b);
    const tol = Number(tolerance);
    const maxIter = Number.parseInt(maxIterations, 10);

    if (![av, bv, tol, maxIter].every(Number.isFinite)) {
      return res.status(400).json({ error: 'Input numerik tidak valid.' });
    }

    if (av >= bv) {
      return res.status(400).json({ error: 'Nilai a harus lebih kecil dari b.' });
    }

    if (tol <= 0) {
      return res.status(400).json({ error: 'Toleransi error harus lebih besar dari 0.' });
    }

    if (maxIter <= 0) {
      return res.status(400).json({ error: 'Maksimum iterasi harus lebih besar dari 0.' });
    }

    const func = createFunction(fx);

    if (!['bisection', 'regula'].includes(method)) {
      return res.status(400).json({ error: 'Metode tidak valid.' });
    }

    const result = method === 'bisection'
      ? computeBisection(func, av, bv, tol, maxIter, fx)
      : computeRegulaFalsi(func, av, bv, tol, maxIter, fx);

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Terjadi kesalahan pada server.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});
