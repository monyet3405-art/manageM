from flask import Flask, render_template, request, jsonify, session
import json
import os
from datetime import datetime, date
import uuid

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY', 'duitku_secret_key_2024') 

if os.getenv('VERCEL'):
    DATA_FILE = '/tmp/duitku_data.json'
else:
    DATA_FILE = 'data.json'

def load_data():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r') as f:
            return json.load(f)
    return {
        'transactions': [],
        'savings_goals': [],
        'xp': 0,
        'level': 1,
        'badges': [],
        'streak': 0,
        'last_login': None
    }

def save_data(data):
    with open(DATA_FILE, 'w') as f:
        json.dump(data, f, indent=2)

def calculate_level(xp):
    thresholds = [0, 100, 250, 500, 1000, 2000, 3500, 5000, 7500, 10000]
    for i, threshold in enumerate(thresholds):
        if xp < threshold:
            return i
    return len(thresholds)

def check_badges(data):
    badges = data.get('badges', [])
    transactions = data.get('transactions', [])
    savings_goals = data.get('savings_goals', [])
    
    new_badges = []
    
    # First transaction badge
    if len(transactions) >= 1 and 'first_transaction' not in badges:
        badges.append('first_transaction')
        new_badges.append({'id': 'first_transaction', 'name': '🎯 Langkah Pertama', 'desc': 'Catat transaksi pertama!'})
        data['xp'] = data.get('xp', 0) + 50
    
    # 10 transactions
    if len(transactions) >= 10 and 'ten_transactions' not in badges:
        badges.append('ten_transactions')
        new_badges.append({'id': 'ten_transactions', 'name': '📝 Rajin Catat', 'desc': '10 transaksi dicatat!'})
        data['xp'] = data.get('xp', 0) + 100
    
    # 50 transactions
    if len(transactions) >= 50 and 'fifty_transactions' not in badges:
        badges.append('fifty_transactions')
        new_badges.append({'id': 'fifty_transactions', 'name': '🏆 Konsisten Boss', 'desc': '50 transaksi dicatat!'})
        data['xp'] = data.get('xp', 0) + 200
    
    # First savings goal
    if len(savings_goals) >= 1 and 'first_goal' not in badges:
        badges.append('first_goal')
        new_badges.append({'id': 'first_goal', 'name': '🌟 Punya Mimpi', 'desc': 'Target tabungan pertama!'})
        data['xp'] = data.get('xp', 0) + 75
    
    # Check completed goals
    completed = [g for g in savings_goals if g.get('current', 0) >= g.get('target', 1)]
    if len(completed) >= 1 and 'goal_completed' not in badges:
        badges.append('goal_completed')
        new_badges.append({'id': 'goal_completed', 'name': '💪 Target Tercapai!', 'desc': 'Selesaikan target pertama!'})
        data['xp'] = data.get('xp', 0) + 300
    
    # Calculate balance
    balance = sum(t['amount'] if t['type'] == 'income' else -t['amount'] for t in transactions)
    if balance >= 1000000 and 'millionaire' not in badges:
        badges.append('millionaire')
        new_badges.append({'id': 'millionaire', 'name': '💰 Sultan Kecil', 'desc': 'Saldo 1 juta!'})
        data['xp'] = data.get('xp', 0) + 150
    
    data['badges'] = badges
    data['level'] = calculate_level(data.get('xp', 0))
    
    return new_badges

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/data', methods=['GET'])
def get_data():
    data = load_data()
    
    # Update streak
    today = date.today().isoformat()
    last = data.get('last_login')
    if last != today:
        if last:
            from datetime import timedelta
            last_date = date.fromisoformat(last)
            diff = (date.today() - last_date).days
            if diff == 1:
                data['streak'] = data.get('streak', 0) + 1
                if data['streak'] % 7 == 0:
                    data['xp'] = data.get('xp', 0) + 50
            elif diff > 1:
                data['streak'] = 1
        else:
            data['streak'] = 1
        data['last_login'] = today
        save_data(data)
    
    transactions = data.get('transactions', [])
    income = sum(t['amount'] for t in transactions if t['type'] == 'income')
    expense = sum(t['amount'] for t in transactions if t['type'] == 'expense')
    balance = income - expense
    
    return jsonify({
        'transactions': transactions,
        'savings_goals': data.get('savings_goals', []),
        'xp': data.get('xp', 0),
        'level': data.get('level', 1),
        'badges': data.get('badges', []),
        'streak': data.get('streak', 0),
        'balance': balance,
        'income': income,
        'expense': expense,
        'next_level_xp': [0, 100, 250, 500, 1000, 2000, 3500, 5000, 7500, 10000][min(data.get('level', 1), 9)]
    })

@app.route('/api/transaction', methods=['POST'])
def add_transaction():
    data = load_data()
    body = request.json
    
    transaction = {
        'id': str(uuid.uuid4()),
        'type': body['type'],
        'category': body['category'],
        'amount': float(body['amount']),
        'description': body.get('description', ''),
        'date': body.get('date', datetime.now().isoformat())
    }
    
    data['transactions'].insert(0, transaction)
    data['xp'] = data.get('xp', 0) + 10
    
    new_badges = check_badges(data)
    save_data(data)
    
    transactions = data['transactions']
    income = sum(t['amount'] for t in transactions if t['type'] == 'income')
    expense = sum(t['amount'] for t in transactions if t['type'] == 'expense')
    
    return jsonify({
        'success': True,
        'transaction': transaction,
        'xp': data['xp'],
        'level': data['level'],
        'new_badges': new_badges,
        'balance': income - expense,
        'income': income,
        'expense': expense
    })

@app.route('/api/transaction/<tid>', methods=['DELETE'])
def delete_transaction(tid):
    data = load_data()
    data['transactions'] = [t for t in data['transactions'] if t['id'] != tid]
    save_data(data)
    
    transactions = data['transactions']
    income = sum(t['amount'] for t in transactions if t['type'] == 'income')
    expense = sum(t['amount'] for t in transactions if t['type'] == 'expense')
    
    return jsonify({'success': True, 'balance': income - expense, 'income': income, 'expense': expense})

@app.route('/api/transactions', methods=['DELETE'])
def delete_all_transactions():
    data = load_data()
    data['transactions'] = []
    save_data(data)
    return jsonify({'success': True})

@app.route('/api/savings', methods=['POST'])
def add_savings_goal():
    data = load_data()
    body = request.json
    
    goal = {
        'id': str(uuid.uuid4()),
        'name': body['name'],
        'target': float(body['target']),
        'current': float(body.get('current', 0)),
        'deadline': body.get('deadline', ''),
        'emoji': body.get('emoji', '🎯'),
        'created': datetime.now().isoformat()
    }
    
    data['savings_goals'].append(goal)
    data['xp'] = data.get('xp', 0) + 20
    
    new_badges = check_badges(data)
    save_data(data)
    
    return jsonify({'success': True, 'goal': goal, 'xp': data['xp'], 'new_badges': new_badges})

@app.route('/api/savings/<gid>/deposit', methods=['POST'])
def deposit_savings(gid):
    data = load_data()
    body = request.json
    amount = float(body['amount'])
    
    for goal in data['savings_goals']:
        if goal['id'] == gid:
            goal['current'] = goal.get('current', 0) + amount
            break
    
    data['xp'] = data.get('xp', 0) + 15
    new_badges = check_badges(data)
    save_data(data)
    
    return jsonify({'success': True, 'xp': data['xp'], 'new_badges': new_badges, 'goals': data['savings_goals']})

@app.route('/api/savings/<gid>', methods=['DELETE'])
def delete_savings_goal(gid):
    data = load_data()
    data['savings_goals'] = [g for g in data['savings_goals'] if g['id'] != gid]
    save_data(data)
    return jsonify({'success': True})

@app.route('/api/simulate', methods=['POST'])
def simulate():
    body = request.json
    principal = float(body.get('principal', 0))
    monthly = float(body.get('monthly', 0))
    rate = float(body.get('rate', 5)) / 100 / 12
    months = int(body.get('months', 60))
    
    results = []
    balance = principal
    total_deposit = principal
    
    for m in range(1, months + 1):
        balance = balance * (1 + rate) + monthly
        total_deposit += monthly
        if m % 12 == 0 or m == months:
            results.append({
                'month': m,
                'year': m // 12,
                'balance': round(balance),
                'total_deposit': round(total_deposit),
                'interest': round(balance - total_deposit)
            })
    
    return jsonify({
        'final_balance': round(balance),
        'total_deposit': round(total_deposit),
        'total_interest': round(balance - total_deposit),
        'growth_percent': round((balance - total_deposit) / max(total_deposit, 1) * 100, 1),
        'results': results
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
