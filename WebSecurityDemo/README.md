# 🏦 CyberBank CTF — University InfoSec Demo

> An intentionally vulnerable banking app for teaching web security to beginners.  
> Three OWASP vulnerabilities, one fictional million-euro heist, ~3 minutes to complete.

![Python](https://img.shields.io/badge/Python-3.9+-blue?style=flat-square&logo=python)
![Flask](https://img.shields.io/badge/Flask-3.0-black?style=flat-square&logo=flask)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)
![Vulnerable](https://img.shields.io/badge/⚠%20Intentionally-Vulnerable-red?style=flat-square)

---

## ⚠️ WARNING

**This app is intentionally insecure.** It exists purely for educational demonstrations.  
**Never deploy this to a public server or production environment.**

---

## 🎯 The Challenge

Students log in as `student` (€50 balance) and must hack their way into **Charlie's** account (€3,000,000) using three chained vulnerabilities:

| Step | Vulnerability | OWASP Category |
|------|--------------|----------------|
| 1 | SQL Injection | A03:2021 – Injection |
| 2 | IDOR | A01:2021 – Broken Access Control |
| 3 | Hidden field manipulation | A01:2021 – Broken Access Control |

---

## 🚀 Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/cyberbank-ctf.git
cd cyberbank-ctf

# 2. Install dependencies
pip install -r requirements.txt

# 3. Run
python app.py
```

Then open:
- **Instructions page:** http://localhost:5000/instructions
- **Banking app:** http://localhost:5000/login

---

## 📁 Project Structure

```
cyberbank-ctf/
├── app.py                  # Flask backend (vulnerabilities live here)
├── requirements.txt
├── README.md
└── templates/
    ├── instructions.html   # Challenge briefing page (shown on info day screen)
    ├── login.html
    ├── dashboard.html
    ├── find_user.html      # Step 1 – SQL Injection
    ├── account.html        # Step 2+3 – IDOR + hidden field
    └── transfer_result.html
```

---

## 🔑 Default Credentials

| Username | Password | PIN | Account ID |
|----------|----------|-----|------------|
| student  | student  | 1234 | 10        |
| alice    | alice    | 9999 | 20        |
| bob      | bob      | 8888 | 30        |
| charlie  | lottery  | 0000 | 9129373   |

---

## 🏛️ Booth Setup (Info Day)

1. Run `python app.py` on the demo laptop
2. Open **two browser tabs**:
   - Tab 1 → `http://localhost:5000/instructions` (show this to students first)
   - Tab 2 → `http://localhost:5000/login` (where they hack)
3. Hit `http://localhost:5000/reset` between students to restore balances

---

## 🐛 The Vulnerabilities (Spoilers)

<details>
<summary>Step 1 — SQL Injection</summary>

The `/find-user?id=` endpoint runs:
```python
raw = f"SELECT ... WHERE users.id = {query}"
```
Input `' OR 1=1 --` dumps all users, revealing Charlie's account ID `9129373`.
</details>

<details>
<summary>Step 2 — IDOR</summary>

Navigating to `/account?id=9129373` returns Charlie's account page.
The server never checks `session["user_id"] == account.user_id`.
</details>

<details>
<summary>Step 3 — Broken Access Control</summary>

The transfer form contains:
```html
<input type="hidden" name="account_id" value="9129373">
```
The server verifies the PIN against `account_id` from the POST body — not the source account.
Change it to `10` (your account) via DevTools, use PIN `1234`, transfer approved.
</details>

---

## 📜 License

MIT — free to use, modify, and share for educational purposes.
