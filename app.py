from flask import Flask, render_template, request, jsonify
import os
import requests
from datetime import datetime, date
import uuid

app = Flask(__name__)

# ============================================================
# SUPABASE CONFIG
# Isi langsung di sini, atau pakai environment variable
# ============================================================
SUPABASE_URL = os.getenv('SUPABASE_URL', 'https://ucpfizlruoejxthunqsz.supabase.co')
SUPABASE_KEY = os.getenv('SUPABASE_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjcGZpemxydW9lanh0aG51cXN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMjIyODUsImV4cCI6MjA5NTY5ODI4NX0.6eEtgeTcJHOg6I9aFgq73TFOLt1fNI6QHP6cDisHkmE')
USER_ID = 'default'

# Header standar untuk semua request ke Supabase
HEADERS = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json',
}

# ============================================================
# FUNGSI DATABASE — LOAD & SAVE
# ============================================================

def default_data():
    """Data kosong untuk user baru"""
    return {
        'transactions': [],
        'savings_goals': [],
        'xp': 0,
        'level': 1,
        'badges': [],
        'streak': 0,
        'last_login': None
    }

def load_data():
    """Ambil data dari Supabase"""
    try:
        url = f"{SUPABASE_URL}/rest/v1/duitku_data?user_id=eq.{USER_ID}"
        res = requests.get(url, headers=HEADERS)

        if res.status_code == 200:
            rows = res.json()
            if rows and len(rows) > 0:
                row = rows[0]
                return {
                    'transactions':   row.get('transactions')   or [],
                    'savings_goals':  row.get('savings_goals')  or [],
                    'xp':             row.get('xp')             or 0,
                    'level':          row.get('level')          or 1,
                    'badges':         row.get('badges')         or [],
                    'streak':         row.get('streak')         or 0,
                    'last_login':     row.get('last_login')
                }
    except Exception as e:
        print(f"[ERROR] load_data: {e}")

    # Kalau gagal atau belum ada data, kembalikan data kosong
    return default_data()

def save_data(data):
    """Simpan data ke Supabase (upsert = insert atau update otomatis)"""
    try:
        url = f"{SUPABASE_URL}/rest/v1/duitku_data"
        payload = {
            'user_id':      USER_ID,
            'transactions': data.get('transactions', []),
            'savings_goals':data.get('savings_goals', []),
            'xp':           data.get('xp', 0),
            'level':        data.get('level', 1),
            'badges':       data.get('badges', []),
            'streak':       data.get('streak', 0),
            'last_login':   data.get('last_login')
        }
        # Prefer: resolution=merge-duplicates → kalau user_id sudah ada, UPDATE
        # Kalau belum ada, INSERT baru
        headers = {
            **HEADERS,
            'Prefer': 'resolution=merge-duplicates,return=representation'
        }
        res = requests.post(url, json=payload, headers=headers)
        return res.status_code in [200, 201]
    except Exception as e:
        print(f"[ERROR] save_data: {e}")
        return False

# ============================================================
# GAME LOGIC
# ============================================================

def calculate_level(xp):
    """Hitung level berdasarkan total XP"""
    thresholds = [0, 100, 250, 500, 1000, 2000, 3500, 5000, 7500, 10000]
    for i, threshold in enumerate(thresholds):
        if xp < threshold:
            return i
    return len(thresholds)

def check_badges(data):
    """Cek dan berikan badge jika syarat terpenuhi"""
    badges       = data.get('badges', [])
    transactions = data.get('transactions', [])
    savings_goals= data.get('savings_goals', [])
    new_badges   = []

    def try_badge(badge_id, name, desc, xp_reward):
        """Helper: berikan badge jika belum dimiliki"""
        if badge_id not in badges:
            badges.append(badge_id)
            new_badges.append({'id': badge_id, 'name': name, 'desc': desc})
            data['xp'] = data.get('xp', 0) + xp_reward

    # Badge berdasarkan jumlah transaksi
    if len(transactions) >= 1:
        try_badge('first_transaction', '🎯 Langkah Pertama', 'Catat transaksi pertama!', 50)
    if len(transactions) >= 10:
        try_badge('ten_transactions', '📝 Rajin Catat', '10 transaksi dicatat!', 100)
    if len(transactions) >= 50:
        try_badge('fifty_transactions', '🏆 Konsisten Boss', '50 transaksi dicatat!', 200)

    # Badge tabungan
    if len(savings_goals) >= 1:
        try_badge('first_goal', '🌟 Punya Mimpi', 'Target tabungan pertama!', 75)

    # Badge goal selesai
    completed = [g for g in savings_goals if g.get('current', 0) >= g.get('target', 1)]
    if len(completed) >= 1:
        try_badge('goal_completed', '💪 Target Tercapai!', 'Selesaikan target pertama!', 300)

    # Badge saldo 1 juta
    balance = sum(t['amount'] if t['type'] == 'income' else -t['amount'] for t in transactions)
    if balance >= 1000000:
        try_badge('millionaire', '💰 Sultan Kecil', 'Saldo 1 juta!', 150)

    data['badges'] = badges
    data['level']  = calculate_level(data.get('xp', 0))
    return new_badges

# ============================================================
# ROUTES — HALAMAN
# ============================================================

@app.route('/')
def index():
    return render_template('index.html')

# ============================================================
# ROUTES — API DATA
# ============================================================

@app.route('/api/data', methods=['GET'])
def get_data():
    data = load_data()

    # Hitung streak login harian
    today = date.today().isoformat()
    last  = data.get('last_login')

    if last != today:
        if last:
            last_date = date.fromisoformat(last)
            diff = (date.today() - last_date).days
            if diff == 1:
                data['streak'] = data.get('streak', 0) + 1
                if data['streak'] % 7 == 0:       # Bonus setiap 7 hari streak
                    data['xp'] = data.get('xp', 0) + 50
            elif diff > 1:
                data['streak'] = 1                 # Reset kalau skip lebih dari 1 hari
        else:
            data['streak'] = 1
        data['last_login'] = today
        save_data(data)

    transactions = data.get('transactions', [])
    income  = sum(t['amount'] for t in transactions if t['type'] == 'income')
    expense = sum(t['amount'] for t in transactions if t['type'] == 'expense')

    return jsonify({
        'transactions':   transactions,
        'savings_goals':  data.get('savings_goals', []),
        'xp':             data.get('xp', 0),
        'level':          data.get('level', 1),
        'badges':         data.get('badges', []),
        'streak':         data.get('streak', 0),
        'balance':        income - expense,
        'income':         income,
        'expense':        expense,
        'next_level_xp':  [0, 100, 250, 500, 1000, 2000, 3500, 5000, 7500, 10000][min(data.get('level', 1), 9)]
    })

# ============================================================
# ROUTES — API TRANSAKSI
# ============================================================

@app.route('/api/transaction', methods=['POST'])
def add_transaction():
    data = load_data()
    body = request.json

    transaction = {
        'id':          str(uuid.uuid4()),
        'type':        body['type'],
        'category':    body['category'],
        'amount':      float(body['amount']),
        'description': body.get('description', ''),
        'date':        body.get('date', datetime.now().isoformat())
    }

    data['transactions'].insert(0, transaction)  # Tambah di urutan paling atas
    data['xp'] = data.get('xp', 0) + 10          # +10 XP setiap transaksi

    new_badges = check_badges(data)
    save_data(data)

    transactions = data['transactions']
    income  = sum(t['amount'] for t in transactions if t['type'] == 'income')
    expense = sum(t['amount'] for t in transactions if t['type'] == 'expense')

    return jsonify({
        'success':     True,
        'transaction': transaction,
        'xp':          data['xp'],
        'level':       data['level'],
        'new_badges':  new_badges,
        'balance':     income - expense,
        'income':      income,
        'expense':     expense
    })

@app.route('/api/transaction/<tid>', methods=['DELETE'])
def delete_transaction(tid):
    data = load_data()
    data['transactions'] = [t for t in data['transactions'] if t['id'] != tid]
    save_data(data)

    transactions = data['transactions']
    income  = sum(t['amount'] for t in transactions if t['type'] == 'income')
    expense = sum(t['amount'] for t in transactions if t['type'] == 'expense')

    return jsonify({'success': True, 'balance': income - expense, 'income': income, 'expense': expense})

@app.route('/api/transactions', methods=['DELETE'])
def delete_all_transactions():
    data = load_data()
    data['transactions'] = []
    save_data(data)
    return jsonify({'success': True})

# ============================================================
# ROUTES — API TABUNGAN
# ============================================================

@app.route('/api/savings', methods=['POST'])
def add_savings_goal():
    data = load_data()
    body = request.json

    goal = {
        'id':       str(uuid.uuid4()),
        'name':     body['name'],
        'target':   float(body['target']),
        'current':  float(body.get('current', 0)),
        'deadline': body.get('deadline', ''),
        'emoji':    body.get('emoji', '🎯'),
        'created':  datetime.now().isoformat()
    }

    data['savings_goals'].append(goal)
    data['xp'] = data.get('xp', 0) + 20    # +20 XP setiap buat goal

    new_badges = check_badges(data)
    save_data(data)

    return jsonify({'success': True, 'goal': goal, 'xp': data['xp'], 'new_badges': new_badges})

@app.route('/api/savings/<gid>/deposit', methods=['POST'])
def deposit_savings(gid):
    data   = load_data()
    body   = request.json
    amount = float(body['amount'])

    for goal in data['savings_goals']:
        if goal['id'] == gid:
            goal['current'] = goal.get('current', 0) + amount
            break

    data['xp'] = data.get('xp', 0) + 15    # +15 XP setiap setor tabungan
    new_badges  = check_badges(data)
    save_data(data)

    return jsonify({'success': True, 'xp': data['xp'], 'new_badges': new_badges, 'goals': data['savings_goals']})

@app.route('/api/savings/<gid>', methods=['DELETE'])
def delete_savings_goal(gid):
    data = load_data()
    data['savings_goals'] = [g for g in data['savings_goals'] if g['id'] != gid]
    save_data(data)
    return jsonify({'success': True})

# ============================================================
# ROUTES — API SIMULASI BUNGA MAJEMUK
# ============================================================

@app.route('/api/simulate', methods=['POST'])
def simulate():
    body      = request.json
    principal = float(body.get('principal', 0))
    monthly   = float(body.get('monthly', 0))
    months    = int(body.get('months', 60))

    # Bunga PER TAHUN → dibagi 12 untuk dapat bunga per bulan
    annual_rate = float(body.get('rate', 5)) / 100
    rate        = annual_rate / 12

    results       = []
    balance       = principal
    total_deposit = principal

    for m in range(1, months + 1):
        # Rumus compound interest per bulan:
        # saldo_baru = saldo_lama × (1 + bunga_bulanan) + tabungan_bulanan
        balance       = balance * (1 + rate) + monthly
        total_deposit += monthly

        # Simpan hasil setiap akhir tahun atau bulan terakhir
        if m % 12 == 0 or m == months:
            results.append({
                'month':         m,
                'year':          m // 12,
                'balance':       round(balance),
                'total_deposit': round(total_deposit),
                'interest':      round(balance - total_deposit)
            })

    return jsonify({
        'final_balance':  round(balance),
        'total_deposit':  round(total_deposit),
        'total_interest': round(balance - total_deposit),
        'growth_percent': round((balance - total_deposit) / max(total_deposit, 1) * 100, 1),
        'results':        results
    })

# ============================================================
# JALANKAN APP
# ============================================================

if __name__ == '__main__':
    app.run(debug=True, port=5000)
