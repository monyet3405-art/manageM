// ===== STATE =====
let state = {
  transactions: [],
  savings_goals: [],
  xp: 0,
  level: 1,
  badges: [],
  streak: 0,
  balance: 0,
  income: 0,
  expense: 0,
  next_level_xp: 100
};

let selectedType = 'income';
let selectedCategory = 'Gaji';
let selectedEmoji = '🏠';
let depositGoalId = null;
let prevLevel = 1;
let simChart = null;

// ===== CATEGORIES =====
const incomeCategories = [
  { icon: '💼', label: 'Gaji' },
  { icon: '📈', label: 'Investasi' },
  { icon: '🏢', label: 'Bisnis' },
  { icon: '🎁', label: 'Hadiah' },
  { icon: '💡', label: 'Freelance' },
  { icon: '🏦', label: 'Tabungan' },
  { icon: '🎮', label: 'Konten' },
  { icon: '➕', label: 'Lainnya' },
];

const expenseCategories = [
  { icon: '🍔', label: 'Makanan' },
  { icon: '🚗', label: 'Transport' },
  { icon: '💡', label: 'Tagihan' },
  { icon: '🎬', label: 'Hiburan' },
  { icon: '🏥', label: 'Kesehatan' },
  { icon: '🛍️', label: 'Belanja' },
  { icon: '📚', label: 'Pendidikan' },
  { icon: '➕', label: 'Lainnya' },
];

const categoryIcons = {};
[...incomeCategories, ...expenseCategories].forEach(c => { categoryIcons[c.label] = c.icon; });

// ===== LEVEL TITLES =====
const levelTitles = [
  '', 'Pemula Hemat', 'Penabung Muda', 'Jagoan Budget', 'Investor Cilik',
  'Sultan Finansial', 'Master Duit', 'Crazy Rich', 'Financial Wizard', 'Money God'
];

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  // Set today's date
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('date-input').value = today;

  renderCategories();
  loadData();
});

async function loadData() {
  const res = await fetch('/api/data');
  const data = await res.json();
  prevLevel = data.level;
  updateState(data);
}

function updateState(data) {
  state = { ...state, ...data };
  renderAll();
}

function renderAll() {
  updateBalanceDisplay();
  updateXPDisplay();
  renderTransactions();
  renderGoals();
  renderAnalysis();
  renderProfile();
}

// ===== BALANCE DISPLAY =====
function updateBalanceDisplay() {
  animateNumber('balance-amount', state.balance, true);
  animateNumber('income-total', state.income, true);
  animateNumber('expense-total', state.expense, true);
}

function animateNumber(id, target, currency = false) {
  const el = document.getElementById(id);
  if (!el) return;
  const current = 0;
  const duration = 600;
  const start = performance.now();
  const startVal = 0;

  function step(time) {
    const elapsed = time - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const val = startVal + (target - startVal) * eased;
    el.textContent = currency ? formatRp(val) : Math.round(val);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function formatRp(num) {
  const abs = Math.abs(num);
  let str;
  if (abs >= 1000000000) str = (abs / 1000000000).toFixed(1) + 'M';
  else if (abs >= 1000000) str = (abs / 1000000).toFixed(1) + 'jt';
  else if (abs >= 1000) str = (abs / 1000).toFixed(0) + 'rb';
  else str = abs.toFixed(0);
  return (num < 0 ? '-' : '') + 'Rp ' + str;
}

function formatRpFull(num) {
  return 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(num));
}

// ===== XP DISPLAY =====
function updateXPDisplay() {
  const xp = state.xp;
  const level = state.level;
  const nextXP = state.next_level_xp;
  const thresholds = [0, 100, 250, 500, 1000, 2000, 3500, 5000, 7500, 10000];
  const prevXP = thresholds[Math.max(0, level - 1)] || 0;
  const pct = nextXP > prevXP ? Math.min(((xp - prevXP) / (nextXP - prevXP)) * 100, 100) : 100;

  document.getElementById('header-level').textContent = 'Lv.' + level;
  const mini = document.getElementById('xp-fill-mini');
  if (mini) mini.style.width = pct + '%';
  document.getElementById('streak-count').textContent = state.streak;
}

// ===== TYPE TOGGLE =====
function setType(type) {
  selectedType = type;
  document.getElementById('type-income').classList.toggle('active', type === 'income');
  document.getElementById('type-expense').classList.toggle('active', type === 'expense');
  selectedCategory = type === 'income' ? 'Gaji' : 'Makanan';
  renderCategories();
}

function renderCategories() {
  const cats = selectedType === 'income' ? incomeCategories : expenseCategories;
  const grid = document.getElementById('category-grid');
  grid.innerHTML = cats.map(c => `
    <button class="cat-btn ${c.label === selectedCategory ? 'active' : ''}" onclick="selectCat('${c.label}')">
      <span class="cat-icon">${c.icon}</span>
      <span>${c.label}</span>
    </button>
  `).join('');
}

function selectCat(label) {
  selectedCategory = label;
  renderCategories();
}

function setQuickAmount(amount) {
  document.getElementById('amount-input').value = amount;
}

// ===== ADD TRANSACTION =====
async function addTransaction() {
  const amount = parseFloat(document.getElementById('amount-input').value);
  const desc = document.getElementById('desc-input').value;
  const date = document.getElementById('date-input').value;

  if (!amount || amount <= 0) {
    shakeElement('amount-input');
    return;
  }

  const res = await fetch('/api/transaction', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: selectedType, category: selectedCategory, amount, description: desc, date })
  });

  const data = await res.json();
  if (!data.success) return;

  // Clear inputs
  document.getElementById('amount-input').value = '';
  document.getElementById('desc-input').value = '';

  // Show XP toast
  showXPToast('+10 XP 🔥');

  // Update state
  state.transactions = [data.transaction, ...state.transactions];
  state.xp = data.xp;
  state.level = data.level;
  state.balance = data.balance;
  state.income = data.income;
  state.expense = data.expense;

  updateBalanceDisplay();
  updateXPDisplay();
  renderTransactions();
  renderAnalysis();

  // Check level up
  if (data.level > prevLevel) {
    prevLevel = data.level;
    showLevelUp(data.level);
  }

  // Show badges
  if (data.new_badges && data.new_badges.length > 0) {
    setTimeout(() => showBadge(data.new_badges[0]), 800);
  }
}

async function deleteTransaction(id) {
  const res = await fetch(`/api/transaction/${id}`, { method: 'DELETE' });
  const data = await res.json();
  state.transactions = state.transactions.filter(t => t.id !== id);
  state.balance = data.balance;
  state.income = data.income;
  state.expense = data.expense;
  updateBalanceDisplay();
  renderTransactions();
  renderAnalysis();
}

async function clearAllTransactions() {
  if (!confirm('Yakin mau hapus semua transaksi? 🗑️')) return;
  await fetch('/api/transactions', { method: 'DELETE' });
  state.transactions = [];
  state.balance = 0;
  state.income = 0;
  state.expense = 0;
  updateBalanceDisplay();
  renderTransactions();
  renderAnalysis();
}

// ===== RENDER TRANSACTIONS =====
function renderTransactions() {
  const list = document.getElementById('transaction-list');
  if (state.transactions.length === 0) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-emoji">💸</div>
      <p>Belum ada transaksi nih!</p>
      <small>Catat dulu yuk biar gak lupa 😄</small>
    </div>`;
    return;
  }

  list.innerHTML = state.transactions.slice(0, 30).map(t => {
    const icon = categoryIcons[t.category] || '💰';
    const dateStr = t.date ? new Date(t.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '';
    const amtStr = (t.type === 'income' ? '+' : '-') + formatRpFull(t.amount);
    return `<div class="txn-card" id="txn-${t.id}">
      <div class="txn-icon ${t.type}">${icon}</div>
      <div class="txn-info">
        <p class="txn-cat">${t.category}</p>
        <p class="txn-desc">${t.description || t.category}</p>
        <p class="txn-date">${dateStr}</p>
      </div>
      <div class="txn-amount-wrap">
        <p class="txn-amount ${t.type}">${amtStr}</p>
      </div>
      <button class="txn-delete" onclick="deleteTransaction('${t.id}')">🗑️</button>
    </div>`;
  }).join('');
}

// ===== SAVINGS GOALS =====
function selectEmoji(el, emoji) {
  document.querySelectorAll('.emoji-opt').forEach(e => e.classList.remove('active'));
  el.classList.add('active');
  selectedEmoji = emoji;
}

async function addGoal() {
  const name = document.getElementById('goal-name').value.trim();
  const target = parseFloat(document.getElementById('goal-target').value);
  const current = parseFloat(document.getElementById('goal-current').value) || 0;
  const deadline = document.getElementById('goal-deadline').value;

  if (!name || !target) {
    shakeElement(name ? 'goal-target' : 'goal-name');
    return;
  }

  const res = await fetch('/api/savings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, target, current, deadline, emoji: selectedEmoji })
  });

  const data = await res.json();
  if (!data.success) return;

  document.getElementById('goal-name').value = '';
  document.getElementById('goal-target').value = '';
  document.getElementById('goal-current').value = '';
  document.getElementById('goal-deadline').value = '';

  state.savings_goals.push(data.goal);
  state.xp = data.xp;
  updateXPDisplay();
  renderGoals();
  showXPToast('+20 XP 🎯');

  if (data.new_badges && data.new_badges.length > 0) {
    setTimeout(() => showBadge(data.new_badges[0]), 600);
  }
}

async function deleteGoal(id) {
  await fetch(`/api/savings/${id}`, { method: 'DELETE' });
  state.savings_goals = state.savings_goals.filter(g => g.id !== id);
  renderGoals();
}

function openDepositModal(id) {
  depositGoalId = id;
  const goal = state.savings_goals.find(g => g.id === id);
  document.getElementById('deposit-goal-name').textContent = goal ? `"${goal.name}"` : '';
  document.getElementById('deposit-amount').value = '';
  document.getElementById('deposit-modal').classList.remove('hidden');
}

function closeDepositModal() {
  document.getElementById('deposit-modal').classList.add('hidden');
  depositGoalId = null;
}

async function submitDeposit() {
  const amount = parseFloat(document.getElementById('deposit-amount').value);
  if (!amount || amount <= 0) return;

  const res = await fetch(`/api/savings/${depositGoalId}/deposit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount })
  });

  const data = await res.json();
  if (!data.success) return;

  state.savings_goals = data.goals;
  state.xp = data.xp;
  closeDepositModal();
  updateXPDisplay();
  renderGoals();
  showXPToast('+15 XP 💰');

  if (data.new_badges && data.new_badges.length > 0) {
    setTimeout(() => showBadge(data.new_badges[0]), 600);
  }
}

function renderGoals() {
  const list = document.getElementById('goals-list');
  if (state.savings_goals.length === 0) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-emoji">🎯</div>
      <p>Belum ada target nih!</p>
      <small>Set goal dulu biar termotivasi! 💪</small>
    </div>`;
    return;
  }

  list.innerHTML = state.savings_goals.map(g => {
    const pct = Math.min((g.current / g.target) * 100, 100).toFixed(1);
    const done = g.current >= g.target;
    const deadlineStr = g.deadline ? `⏰ Deadline: ${new Date(g.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}` : 'Tanpa deadline';
    return `<div class="goal-card">
      <div class="goal-header">
        <div class="goal-emoji">${g.emoji || '🎯'}</div>
        <div class="goal-info">
          <p class="goal-name">${g.name}</p>
          <p class="goal-deadline">${deadlineStr}</p>
        </div>
        <button class="goal-delete" onclick="deleteGoal('${g.id}')">🗑️</button>
      </div>
      <div class="goal-progress-wrap">
        <div class="goal-progress-bar">
          <div class="goal-progress-fill" style="width: ${pct}%"></div>
        </div>
        <div class="goal-progress-text">
          <span>${formatRpFull(g.current)} / ${formatRpFull(g.target)}</span>
          <span>${done ? '<span class="goal-complete-badge">✅ Tercapai!</span>' : `<span class="goal-pct">${pct}%</span>`}</span>
        </div>
      </div>
      ${!done ? `<button class="btn-deposit" onclick="openDepositModal('${g.id}')">💰 Tambah Setoran</button>` : '<p style="text-align:center; color: var(--green2); font-weight: 800; font-size: 0.9rem;">🎉 Target Tercapai! Mantap!</p>'}
    </div>`;
  }).join('');
}

// ===== SIMULATION =====
function updateDurationLabel() {
  const months = parseInt(document.getElementById('sim-months').value);
  const years = Math.floor(months / 12);
  const rem = months % 12;
  let label = '';
  if (years > 0) label += years + ' tahun ';
  if (rem > 0) label += rem + ' bulan';
  document.getElementById('sim-duration-label').textContent = label.trim();
}

async function runSimulation() {
  const principal = parseFloat(document.getElementById('sim-principal').value) || 0;
  const monthly = parseFloat(document.getElementById('sim-monthly').value) || 0;
  const rate = parseFloat(document.getElementById('sim-rate').value) || 5;
  const months = parseInt(document.getElementById('sim-months').value) || 60;

  const res = await fetch('/api/simulate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ principal, monthly, rate, months })
  });

  const data = await res.json();

  document.getElementById('sim-final').textContent = formatRpFull(data.final_balance);
  document.getElementById('sim-deposit').textContent = formatRpFull(data.total_deposit);
  document.getElementById('sim-interest').textContent = formatRpFull(data.total_interest);
  document.getElementById('sim-growth').textContent = data.growth_percent + '%';

  document.getElementById('sim-result').classList.remove('hidden');
  renderSimChart(data.results);
}

function renderSimChart(results) {
  const ctx = document.getElementById('sim-chart').getContext('2d');
  if (simChart) simChart.destroy();

  const labels = results.map(r => r.year ? r.year + ' thn' : r.month + ' bln');
  const balances = results.map(r => r.balance);
  const deposits = results.map(r => r.total_deposit);

  simChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Total Akhir',
          data: balances,
          borderColor: '#7C6FFF',
          backgroundColor: 'rgba(124,111,255,0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: '#7C6FFF'
        },
        {
          label: 'Modal Disetor',
          data: deposits,
          borderColor: '#FF6B9D',
          backgroundColor: 'rgba(255,107,157,0.05)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: '#FF6B9D'
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: '#BBBBDD', font: { family: 'Nunito', size: 11 } } },
        tooltip: {
          callbacks: {
            label: ctx => ' ' + formatRpFull(ctx.raw)
          }
        }
      },
      scales: {
        x: { ticks: { color: '#8888AA', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: {
          ticks: { color: '#8888AA', font: { size: 10 }, callback: v => formatRp(v) },
          grid: { color: 'rgba(255,255,255,0.05)' }
        }
      }
    }
  });
}

// ===== ANALYSIS =====
function renderAnalysis() {
  const container = document.getElementById('analisis-content');
  const expenses = state.transactions.filter(t => t.type === 'expense');

  if (expenses.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-emoji">📊</div>
      <p>Belum cukup data!</p>
      <small>Tambah transaksi pengeluaran dulu yuk 😊</small>
    </div>`;
    return;
  }

  // Group by category
  const catMap = {};
  expenses.forEach(t => {
    catMap[t.category] = (catMap[t.category] || 0) + t.amount;
  });

  const total = Object.values(catMap).reduce((a, b) => a + b, 0);
  const sorted = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  const colors = ['#7C6FFF','#FF6B9D','#FFD166','#06D6A0','#FF9F43','#93C5FD','#F9A8D4','#6EE7B7'];

  container.innerHTML = `
    <div class="pie-wrap">
      <canvas id="pie-chart" height="200"></canvas>
    </div>
    <div class="analisis-grid">
      ${sorted.map(([cat, amt], i) => {
        const pct = ((amt / total) * 100).toFixed(1);
        const icon = categoryIcons[cat] || '💰';
        return `<div class="analisis-cat-card">
          <div class="analisis-cat-icon">${icon}</div>
          <div class="analisis-cat-info">
            <p class="analisis-cat-name">${cat}</p>
            <div class="analisis-bar"><div class="analisis-bar-fill" style="width: ${pct}%; background: ${colors[i % colors.length]}"></div></div>
            <p style="font-size:0.72rem; color: var(--text-muted); margin-top:2px;">${formatRpFull(amt)}</p>
          </div>
          <span class="analisis-cat-pct">${pct}%</span>
        </div>`;
      }).join('')}
    </div>`;

  // Render pie
  setTimeout(() => {
    const pie = document.getElementById('pie-chart');
    if (!pie) return;
    new Chart(pie.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: sorted.map(([k]) => k),
        datasets: [{
          data: sorted.map(([, v]) => v),
          backgroundColor: colors,
          borderWidth: 0,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#BBBBDD', font: { family: 'Nunito', size: 11 }, padding: 12 } },
          tooltip: { callbacks: { label: ctx => ' ' + formatRpFull(ctx.raw) } }
        },
        cutout: '65%'
      }
    });
  }, 100);
}

// ===== PROFILE =====
const allBadges = [
  { id: 'first_transaction', name: '🎯 Langkah Pertama', desc: 'Catat transaksi pertama!', icon: '🎯' },
  { id: 'ten_transactions', name: '📝 Rajin Catat', desc: '10 transaksi dicatat!', icon: '📝' },
  { id: 'fifty_transactions', name: '🏆 Konsisten Boss', desc: '50 transaksi dicatat!', icon: '🏆' },
  { id: 'first_goal', name: '🌟 Punya Mimpi', desc: 'Target tabungan pertama!', icon: '🌟' },
  { id: 'goal_completed', name: '💪 Target Tercapai!', desc: 'Selesaikan target pertama!', icon: '💪' },
  { id: 'millionaire', name: '💰 Sultan Kecil', desc: 'Saldo 1 juta!', icon: '💰' },
];

function renderProfile() {
  const xp = state.xp;
  const level = state.level;
  const nextXP = state.next_level_xp;
  const thresholds = [0, 100, 250, 500, 1000, 2000, 3500, 5000, 7500, 10000];
  const prevXP = thresholds[Math.max(0, level - 1)] || 0;
  const pct = nextXP > prevXP ? Math.min(((xp - prevXP) / (nextXP - prevXP)) * 100, 100) : 100;

  document.getElementById('profile-level-badge').textContent = 'Level ' + level;
  document.getElementById('level-title').textContent = levelTitles[level] || 'Money God';
  document.getElementById('xp-display').textContent = `${xp} / ${nextXP} XP`;
  document.getElementById('xp-needed').textContent = Math.max(0, nextXP - xp);
  document.getElementById('xp-fill').style.width = pct + '%';
  document.getElementById('streak-display').textContent = state.streak + ' Hari Streak';

  // Badges
  const grid = document.getElementById('badges-grid');
  grid.innerHTML = allBadges.map(b => {
    const earned = state.badges.includes(b.id);
    return `<div class="badge-card ${earned ? 'earned' : 'locked'}">
      <span class="badge-icon">${b.icon}</span>
      <p class="badge-name">${b.name}</p>
      <p class="badge-bdesc">${b.desc}</p>
    </div>`;
  }).join('');
}

// ===== TAB NAVIGATION =====
function showTab(name) {
  document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  document.getElementById('nav-' + name).classList.add('active');
}

// ===== GAMIFICATION =====
function showXPToast(msg) {
  const toast = document.getElementById('xp-toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 2200);
}

function showBadge(badge) {
  document.getElementById('badge-emoji').textContent = badge.name.split(' ')[0];
  document.getElementById('badge-name').textContent = badge.name;
  document.getElementById('badge-desc').textContent = badge.desc;
  document.getElementById('badge-modal').classList.remove('hidden');
}

function closeBadgeModal() {
  document.getElementById('badge-modal').classList.add('hidden');
}

function showLevelUp(level) {
  document.getElementById('levelup-num').textContent = level;
  document.getElementById('levelup-modal').classList.remove('hidden');
}

// ===== UTILS =====
function shakeElement(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.animation = 'none';
  el.offsetHeight;
  el.style.animation = 'shake 0.4s ease';
  setTimeout(() => el.style.animation = '', 400);
}

// Add shake keyframes
const style = document.createElement('style');
style.textContent = `@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-6px); }
  75% { transform: translateX(6px); }
}`;
document.head.appendChild(style);