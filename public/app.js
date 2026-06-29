document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('calculatorForm');
  if (!form) return;

  form.addEventListener('submit', handleSubmit);
  form.addEventListener('reset', handleReset);
});

async function handleSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const submitButton = form.querySelector('[data-action="calculate"]');
  const method = submitButton?.dataset.method || getMethodFromPath();
  const payload = getFormValues();

  clearMessage();
  clearResult();

  const validation = validateInput(payload);
  if (!validation.valid) {
    showMessage(validation.message, 'error');
    return;
  }

  if (!method) {
    showMessage('Metode tidak dikenali dari halaman ini.', 'error');
    return;
  }

  try {
    setLoadingState(true);

    const response = await fetch('/api/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, method }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Terjadi kesalahan pada server.');
    }

    //showMessage(data.message, data.converged ? 'success' : 'warning');
    renderResult(data);
  } catch (error) {
    showMessage(error.message, 'error');
  } finally {
    setLoadingState(false);
  }
}

function getMethodFromPath() {
  const path = window.location.pathname.toLowerCase();
  if (path.includes('bisection')) return 'bisection';
  if (path.includes('regula-falsi')) return 'regula';
  return null;
}

function getFormValues() {
  const fx = document.getElementById('fx')?.value.trim() ?? '';
  const a = Number.parseFloat(document.getElementById('a')?.value);
  const b = Number.parseFloat(document.getElementById('b')?.value);
  const tolerance = Number.parseFloat(document.getElementById('tolerance')?.value);
  const maxIterations = Number.parseInt(document.getElementById('maxIterations')?.value, 10);

  return { fx, a, b, tolerance, maxIterations };
}

function validateInput(data) {
  if (!data.fx) {
    return { valid: false, message: 'Fungsi f(x) tidak boleh kosong.' };
  }

  if (!Number.isFinite(data.a) || !Number.isFinite(data.b)) {
    return { valid: false, message: 'Nilai interval a dan b harus diisi.' };
  }

  if (data.a >= data.b) {
    return { valid: false, message: 'Nilai a harus lebih kecil dari b.' };
  }

  if (!Number.isFinite(data.tolerance) || data.tolerance <= 0) {
    return { valid: false, message: 'Toleransi error harus lebih besar dari 0.' };
  }

  if (!Number.isFinite(data.maxIterations) || data.maxIterations <= 0) {
    return { valid: false, message: 'Maksimum iterasi harus lebih besar dari 0.' };
  }

  return { valid: true };
}

function renderResult(data) {
  const resultContainer = document.getElementById('result');
  if (!resultContainer) return;

  const iterationRows = (data.iterations || []).map((row, index) => {
    const isConverged = Boolean(row.status);

    return `
      <tr class="${isConverged ? 'row-ok' : ''}">
        <td>${index}</td>
        <td>${formatNumber(row.a)}</td>
        <td>${formatNumber(row.b)}</td>
        <td>${formatNumber(row.c)}</td>
        <td>${formatNumber(row.fa)}</td>
        <td>${formatNumber(row.fb)}</td>
        <td>${formatNumber(row.fc)}</td>
        <td>${row.newInterval}</td>
        <td>${formatNumber(row.error)}</td>
        <td>${isConverged ? 'TRUE' : 'FALSE'}</td>
      </tr>
    `;
  }).join('');

  const statusText = data.converged ? 'Konvergen' : 'Belum Konvergen';

  resultContainer.innerHTML = `
    <div class="result-box">
      <div class="result-head">
        <h3>Hasil Perhitungan</h3>
      </div>
      <div class="result-body">
        <div class="final-result">
          <h2>${escapeHtml(data.methodLabel || 'Hasil')} : x = ${formatNumber(data.root)}</h2>
          <p>${statusText}</p>
        </div>

        <div class="summary-box">
          <div class="summary-item">
            <span>Metode</span>
            <strong>${escapeHtml(data.methodLabel || '-')}</strong>
          </div>
          <div class="summary-item">
            <span>Fungsi</span>
            <strong>${escapeHtml(data.fx || '-')}</strong>
          </div>
          <div class="summary-item">
            <span>Interval</span>
            <strong>[${formatNumber(data.a)}, ${formatNumber(data.b)}]</strong>
          </div>
          <div class="summary-item">
            <span>Toleransi</span>
            <strong>${formatNumber(data.tolerance)}</strong>
          </div>
          <div class="summary-item">
            <span>Status</span>
            <strong>${statusText}</strong>
          </div>
          <div class="summary-item">
            <span>Iterasi Terakhir</span>
            <strong>${(data.iterations || []).length - 1}</strong>
          </div>
        </div>

        <div class="table-wrap">
          <table class="result-table">
            <thead>
              <tr>
                <th>Iterasi</th>
                <th>a</th>
                <th>b</th>
                <th>c</th>
                <th>f(a)</th>
                <th>f(b)</th>
                <th>f(c)</th>
                <th>Selang Baru</th>
                <th>Lebarnya/ɛ</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${iterationRows}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  if (!data.converged) {
    showMessage('Metode selesai namun belum mencapai toleransi yang ditentukan.', 'warning');
  } else {
    showMessage(data.message || 'Perhitungan selesai.', 'success');
  }
}

function setLoadingState(isLoading) {
  const button = document.querySelector('[data-action="calculate"]');
  if (!button) return;

  if (isLoading) {
    button.disabled = true;
    button.dataset.originalText = button.textContent || 'Hitung';
    button.textContent = 'Menghitung...';
  } else {
    button.disabled = false;
    button.textContent = button.dataset.originalText || 'Hitung';
  }
}

function showMessage(message, type = 'info') {
  const messageContainer = document.getElementById('message');
  if (!messageContainer) return;

  messageContainer.innerHTML = `<div class="alert ${type}">${escapeHtml(message)}</div>`;
}

function clearMessage() {
  const messageContainer = document.getElementById('message');
  if (messageContainer) messageContainer.innerHTML = '';
}

function clearResult() {
  const resultContainer = document.getElementById('result');
  if (resultContainer) resultContainer.innerHTML = '';
}

function handleReset() {
  clearMessage();
  clearResult();
}

function formatNumber(value) {
  if (value === undefined || value === null || Number.isNaN(Number(value))) {
    return '-';
  }
  const number = Number(value);

  if (Number.isInteger(number)) {
    return String(number);
  }

  return Number(number.toFixed(6)).toString();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fillExample() {
  const fxInput = document.getElementById('fx');
  const aInput = document.getElementById('a');
  const bInput = document.getElementById('b');
  const toleranceInput = document.getElementById('tolerance');
  const maxIterationsInput = document.getElementById('maxIterations');

  if (fxInput) fxInput.value = 'x^3 - x - 2';
  if (aInput) aInput.value = 1;
  if (bInput) bInput.value = 2;
  if (toleranceInput) toleranceInput.value = 0.01;
  if (maxIterationsInput) maxIterationsInput.value = 25;

  clearMessage();
  clearResult();
}
