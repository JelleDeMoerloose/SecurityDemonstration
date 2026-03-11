from flask import Flask, request, session, redirect, url_for, render_template, jsonify
import sqlite3, os

app = Flask(__name__)
app.secret_key = "supersecretkey_notreallysecure"
DB = "bank.db"

# ─── DB SETUP ────────────────────────────────────────────────────────────────

def init_db():
    con = sqlite3.connect(DB)
    cur = con.cursor()
    cur.executescript("""
        DROP TABLE IF EXISTS users;
        DROP TABLE IF EXISTS accounts;

        CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            username TEXT,
            password TEXT,
            pin TEXT
        );

        CREATE TABLE accounts (
            id INTEGER PRIMARY KEY,
            user_id INTEGER,
            balance REAL
        );

        INSERT INTO users VALUES (1,  'student', 'student', '1234');
        INSERT INTO users VALUES (2,  'alice',   'alice',   '9999');
        INSERT INTO users VALUES (3,  'bob',     'bob',     '8888');
        INSERT INTO users VALUES (9172,  'charlie', 'lottery', '0000');

        INSERT INTO accounts VALUES (10,  1, 50.00);
        INSERT INTO accounts VALUES (20,  2, 1200.00);
        INSERT INTO accounts VALUES (30,  3, 340.00);
        INSERT INTO accounts VALUES (9129373, 9172, 3000000.00);
    """)
    con.commit()
    con.close()

def get_db():
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    return con

# ─── ROUTES ──────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return redirect(url_for("login"))

@app.route("/instructions")
def instructions():
    return render_template("instructions.html")

@app.route("/login", methods=["GET", "POST"])
def login():
    error = None
    if request.method == "POST":
        username = request.form["username"]
        password = request.form["password"]
        con = get_db()
        user = con.execute(
            "SELECT * FROM users WHERE username=? AND password=?",
            (username, password)
        ).fetchone()
        con.close()
        if user:
            session["user_id"] = user["id"]
            session["username"] = user["username"]
            return redirect(url_for("dashboard"))
        error = "Invalid credentials."
    return render_template("login.html", error=error)

@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))

@app.route("/dashboard")
def dashboard():
    if "user_id" not in session:
        return redirect(url_for("login"))
    con = get_db()
    acc = con.execute("SELECT * FROM accounts WHERE user_id=?", (session["user_id"],)).fetchone()
    con.close()
    return render_template("dashboard.html", username=session["username"], balance=acc["balance"], account_id=acc["id"])

# ── VULNERABILITY 1: SQL Injection ───────────────────────────────────────────
@app.route("/find-user")
def find_user():
    if "user_id" not in session:
        return redirect(url_for("login"))
    query = request.args.get("id", "")
    results = []
    error = None
    if query:
        try:
            con = sqlite3.connect(DB)
            con.row_factory = sqlite3.Row
            # ⚠️  INTENTIONALLY VULNERABLE – SQL injection
            raw = f"SELECT users.id, users.username, accounts.id as acc_id FROM users JOIN accounts ON users.id = accounts.user_id WHERE accounts.user_id = {query}"
            rows = con.execute(raw).fetchall()
            print(rows)
            results = [{"user_id": r["id"], "username": r["username"], "acc_id": r["acc_id"]} for r in rows]
            con.close()
        except Exception as e:
            error = str(e)
    return render_template("find_user.html", query=query, results=results, error=error)

# ── VULNERABILITY 2: IDOR ─────────────────────────────────────────────────────
@app.route("/account")
def account():
    if "user_id" not in session:
        return redirect(url_for("login"))
    acc_id = request.args.get("id", "")
    account = None
    owner = None
    if acc_id:
        con = get_db()
        # ⚠️  INTENTIONALLY VULNERABLE – no ownership check
        acc = con.execute("SELECT * FROM accounts WHERE id=?", (acc_id,)).fetchone()
        if acc:
            owner = con.execute("SELECT username FROM users WHERE id=?", (acc["user_id"],)).fetchone()
            account = {"id": acc["id"], "balance": acc["balance"], "username": owner["username"] if owner else "Unknown"}
        con.close()
    return render_template("account.html", account=account, acc_id=acc_id, viewer=session["username"], viewer_acc_id=get_student_acc_id())

def get_student_acc_id():
    if "user_id" not in session:
        return None
    con = get_db()
    acc = con.execute("SELECT id FROM accounts WHERE user_id=?", (session["user_id"],)).fetchone()
    con.close()
    return acc["id"] if acc else None

# ── VULNERABILITY 3: PIN verified against wrong account ───────────────────────
@app.route("/transfer", methods=["POST"])
def transfer():
    if "user_id" not in session:
        return redirect(url_for("login"))

    from_acc   = int(request.form.get("from_acc", 0))
    to_user    = request.form.get("to_user", "student")
    amount     = float(request.form.get("amount", 0))
    pin        = request.form.get("pin", "")
    # ⚠️  INTENTIONALLY VULNERABLE – account_id comes from hidden form field
    verify_acc = int(request.form.get("account_id", from_acc))

    con = get_db()
    # Verify PIN against verify_acc (not from_acc!)
    pin_owner = con.execute(
        "SELECT users.pin FROM users JOIN accounts ON users.id = accounts.user_id WHERE accounts.id=?",
        (verify_acc,)
    ).fetchone()

    if not pin_owner or pin_owner["pin"] != pin:
        con.close()
        return render_template("transfer_result.html", success=False, error="❌ Wrong PIN.")

    src  = con.execute("SELECT * FROM accounts WHERE id=?", (from_acc,)).fetchone()
    to_u = con.execute("SELECT * FROM users WHERE username=?", (to_user,)).fetchone()
    if not src or not to_u:
        con.close()
        return render_template("transfer_result.html", success=False, error="❌ Account not found.")

    dst = con.execute("SELECT * FROM accounts WHERE user_id=?", (to_u["id"],)).fetchone()

    old_src = src["balance"]
    old_dst = dst["balance"]
    new_src = old_src - amount
    new_dst = old_dst + amount

    con.execute("UPDATE accounts SET balance=? WHERE id=?", (new_src, src["id"]))
    con.execute("UPDATE accounts SET balance=? WHERE id=?", (new_dst, dst["id"]))
    con.commit()
    con.close()

    return render_template("transfer_result.html",
        success=True,
        from_user=src["id"], to_user=to_user,
        old_src=old_src, new_src=new_src,
        old_dst=old_dst, new_dst=new_dst,
        amount=amount
    )

@app.route("/reset")
def reset():
    init_db()
    session.clear()
    return redirect(url_for("login"))

if __name__ == "__main__":
    init_db()
    app.run(debug=True, port=5000)
