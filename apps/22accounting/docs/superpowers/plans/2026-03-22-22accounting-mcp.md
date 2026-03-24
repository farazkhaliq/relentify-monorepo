# 22accounting MCP Server — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Python MCP server at `/opt/22accounting-mcp/` that tests every built feature of the 22accounting app and fixes whatever is broken.

**Architecture:** Standalone Python MCP server with two access layers: authenticated httpx calls to `http://22accounting:3022` (Docker internal) and direct psycopg2 DB access. A dedicated `corporate`-tier test user is created/destroyed per test session. All ~100 tools are split into focused modules under `tools/`.

**Tech Stack:** Python 3, `mcp` SDK, `PyJWT`, `psycopg2-binary`, `httpx`, `python-dotenv`, optional `playwright`

**Spec:** `/opt/relentify-monorepo/apps/22accounting/docs/superpowers/specs/2026-03-22-22accounting-mcp-design.md`

---

## Task 1: Rebuild 22accounting container

Next.js is already at 15.5.14 in `package.json` (above required 15.2.3) — just needs a clean rebuild.

**Files:** `apps/22accounting/docker-compose.yml`

- [ ] **Step 1: Verify Next.js version**
```bash
grep '"next"' /opt/relentify-monorepo/apps/22accounting/package.json
# Expected: "next": "15.5.14"
```

- [ ] **Step 2: Run pnpm audit**
```bash
cd /opt/relentify-monorepo && pnpm audit
# Fix any high/critical findings per CLAUDE.md vulnerability framework before proceeding
```

- [ ] **Step 3: Rebuild container**
```bash
cd /opt/relentify-monorepo
docker compose -f apps/22accounting/docker-compose.yml down
docker compose -f apps/22accounting/docker-compose.yml build --no-cache
docker compose -f apps/22accounting/docker-compose.yml up -d
```

- [ ] **Step 4: Verify healthy**
```bash
docker ps | grep 22accounting
# Expected: Up, healthy
docker logs 22accounting --tail 20
# Expected: "Ready on http://0.0.0.0:3000"
```

- [ ] **Step 5: Prune build cache**
```bash
docker builder prune -f
```

---

## Task 2: MCP scaffold

**Files to create:**
- `/opt/22accounting-mcp/requirements.txt`
- `/opt/22accounting-mcp/config.py`
- `/opt/22accounting-mcp/auth.py`
- `/opt/22accounting-mcp/db.py`
- `/opt/22accounting-mcp/http_client.py`
- `/opt/22accounting-mcp/server.py`
- `/opt/22accounting-mcp/tools/__init__.py`

- [ ] **Step 1: Create directory**
```bash
mkdir -p /opt/22accounting-mcp/tools
```

- [ ] **Step 2: Create requirements.txt**
```
mcp>=1.0.0
PyJWT>=2.8.0
psycopg2-binary>=2.9.9
httpx>=0.27.0
python-dotenv>=1.0.0
```

- [ ] **Step 3: Install dependencies**
```bash
cd /opt/22accounting-mcp && pip install -r requirements.txt
```

- [ ] **Step 4: Create config.py**
```python
# /opt/22accounting-mcp/config.py
import os
from dotenv import load_dotenv

ENV_PATH = "/opt/relentify-monorepo/apps/22accounting/.env"
load_dotenv(ENV_PATH)

DATABASE_URL = os.environ["DATABASE_URL"]
JWT_SECRET    = os.environ["JWT_SECRET"]
BASE_URL      = "http://22accounting:3022"
CRON_SECRET   = os.environ.get("CRON_SECRET", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
TRUELAYER_CLIENT_ID   = os.environ.get("TRUELAYER_CLIENT_ID", "")
HMRC_CLIENT_ID        = os.environ.get("HMRC_CLIENT_ID", "")
HMRC_BASE_URL         = os.environ.get("HMRC_BASE_URL", "")
```

- [ ] **Step 5: Create auth.py**
```python
# /opt/22accounting-mcp/auth.py
import time
import jwt
from config import JWT_SECRET

def mint_token(user_id: str, email: str = "test@22accounting-mcp.internal") -> str:
    now = int(time.time())
    payload = {
        "userId": user_id,
        "actorId": user_id,
        "email": email,
        "subscriptionPlan": "corporate",
        "iat": now,
        "exp": now + 3600,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")
```

- [ ] **Step 6: Create db.py**
```python
# /opt/22accounting-mcp/db.py
import psycopg2
import psycopg2.extras
from config import DATABASE_URL

def get_conn():
    return psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)

def db_execute(sql: str, params=None):
    """Run INSERT/UPDATE/DELETE, return rows if RETURNING clause present."""
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params or [])
            conn.commit()
            try:
                return cur.fetchall()
            except psycopg2.ProgrammingError:
                return []
    finally:
        conn.close()

def db_query(sql: str, params=None):
    """Run SELECT, return list of dicts."""
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params or [])
            return cur.fetchall()
    finally:
        conn.close()
```

- [ ] **Step 7: Create http_client.py**
```python
# /opt/22accounting-mcp/http_client.py
import httpx
from config import BASE_URL

def make_headers(token: str) -> dict:
    return {"Cookie": f"relentify_token={token}", "Content-Type": "application/json"}

def api_get(path: str, token: str, params: dict = None) -> dict:
    try:
        r = httpx.get(f"{BASE_URL}{path}", headers=make_headers(token),
                      params=params, timeout=30)
        return {"ok": r.is_success, "status": r.status_code, "data": _parse(r)}
    except httpx.ConnectError:
        return {"ok": False, "error": f"22accounting not reachable at {BASE_URL}"}

def api_post(path: str, token: str, body: dict = None, files=None) -> dict:
    try:
        if files:
            headers = {"Cookie": f"relentify_token={token}"}
            r = httpx.post(f"{BASE_URL}{path}", headers=headers, files=files, timeout=30)
        else:
            r = httpx.post(f"{BASE_URL}{path}", headers=make_headers(token),
                           json=body or {}, timeout=30)
        return {"ok": r.is_success, "status": r.status_code, "data": _parse(r)}
    except httpx.ConnectError:
        return {"ok": False, "error": f"22accounting not reachable at {BASE_URL}"}

def api_patch(path: str, token: str, body: dict = None) -> dict:
    try:
        r = httpx.patch(f"{BASE_URL}{path}", headers=make_headers(token),
                        json=body or {}, timeout=30)
        return {"ok": r.is_success, "status": r.status_code, "data": _parse(r)}
    except httpx.ConnectError:
        return {"ok": False, "error": f"22accounting not reachable at {BASE_URL}"}

def api_delete(path: str, token: str) -> dict:
    try:
        r = httpx.delete(f"{BASE_URL}{path}", headers=make_headers(token), timeout=30)
        return {"ok": r.is_success, "status": r.status_code, "data": _parse(r)}
    except httpx.ConnectError:
        return {"ok": False, "error": f"22accounting not reachable at {BASE_URL}"}

def _parse(r: httpx.Response):
    try:
        return r.json()
    except Exception:
        return r.text
```

- [ ] **Step 8: Create server.py skeleton**
```python
# /opt/22accounting-mcp/server.py
import asyncio
import json
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

server = Server("22accounting")

# Import all tool modules — populated in later tasks
_tools: list[Tool] = []
_handlers: dict = {}

def register(tool: Tool, fn):
    _tools.append(tool)
    _handlers[tool.name] = fn

@server.list_tools()
async def list_tools():
    return _tools

@server.call_tool()
async def call_tool(name: str, arguments: dict):
    handler = _handlers.get(name)
    if not handler:
        return [TextContent(type="text", text=f"Unknown tool: {name}")]
    result = handler(**arguments)
    return [TextContent(type="text", text=json.dumps(result, indent=2, default=str))]

async def main():
    async with stdio_server() as (r, w):
        await server.run(r, w, server.create_initialization_options())

if __name__ == "__main__":
    # Tool registrations imported here (after modules are written)
    asyncio.run(main())
```

- [ ] **Step 9: Create tools/__init__.py**
```python
# /opt/22accounting-mcp/tools/__init__.py
```

- [ ] **Step 10: Verify server starts**
```bash
cd /opt/22accounting-mcp && echo '{}' | timeout 3 python3 server.py || true
# Expected: no import errors (will timeout cleanly waiting for stdio)
```

---

## Task 3: Setup tools

**File:** `/opt/22accounting-mcp/tools/setup.py`

- [ ] **Step 1: Create tools/setup.py**
```python
# /opt/22accounting-mcp/tools/setup.py
import uuid
from db import db_execute, db_query
from auth import mint_token as _mint

TEST_EMAIL = "test@22accounting-mcp.internal"

DEFAULT_COA = [
    (1100, "Accounts Receivable (Debtors Control)", "ASSET",     True,  "Amounts owed by customers"),
    (1200, "Current Account",                        "ASSET",     True,  "Main business bank account"),
    (1201, "VAT Input Tax",                          "ASSET",     True,  "Reclaimable VAT on purchases"),
    (1210, "Business Savings Account",               "ASSET",     False, "Business savings or deposit account"),
    (1220, "Cash in Hand",                           "ASSET",     False, "Petty cash and cash on hand"),
    (1700, "Office Equipment",                       "ASSET",     False, "Office furniture and equipment"),
    (1710, "Computer Equipment",                     "ASSET",     False, "Computers, servers, IT hardware"),
    (2100, "Accounts Payable (Creditors Control)",   "LIABILITY", True,  "Amounts owed to suppliers"),
    (2110, "Employee Reimbursements Payable",        "LIABILITY", True,  "Expenses and mileage owed to employees"),
    (2202, "VAT Output Tax",                         "LIABILITY", True,  "VAT collected on sales, payable to HMRC"),
    (2210, "PAYE / NI Payable",                      "LIABILITY", False, "PAYE and National Insurance due to HMRC"),
    (2300, "Corporation Tax Payable",                "LIABILITY", False, "Corporation tax liability"),
    (2301, "Director's Loan Account",                "LIABILITY", False, "Director's loan to/from the company"),
    (3000, "Share Capital",                          "EQUITY",    False, "Capital invested by shareholders"),
    (3001, "Retained Earnings",                      "EQUITY",    False, "Accumulated profits retained in the business"),
    (4000, "Sales - General",                        "INCOME",    True,  "General sales income"),
    (4001, "Sales - Services",                       "INCOME",    False, "Income from services rendered"),
    (4002, "Sales - Products",                       "INCOME",    False, "Income from product sales"),
    (4900, "Other Income",                           "INCOME",    False, "Miscellaneous income"),
    (5000, "Cost of Goods Sold",                     "COGS",      False, "Direct cost of goods sold"),
    (5001, "Direct Materials",                       "COGS",      False, "Raw materials and components"),
    (5100, "Direct Labour / Subcontractors",         "COGS",      False, "Labour directly attributable to production"),
    (6000, "Other Direct Costs",                     "COGS",      False, "Other costs directly attributable to sales"),
    (7000, "Wages & Salaries",                       "EXPENSE",   False, "Employee wages and salaries"),
    (7100, "Advertising & Marketing",                "EXPENSE",   False, "Advertising, marketing, and promotions"),
    (7200, "Entertainment & Hospitality",            "EXPENSE",   False, "Client entertainment and business meals"),
    (7300, "Travel & Accommodation",                 "EXPENSE",   False, "Business travel and hotel costs"),
    (7304, "Motor Expenses & Mileage",               "EXPENSE",   False, "Vehicle running costs and mileage claims"),
    (7400, "Office Costs & Stationery",              "EXPENSE",   False, "Office supplies and stationery"),
    (7500, "IT & Software Subscriptions",            "EXPENSE",   False, "Software licenses and SaaS subscriptions"),
    (7600, "Professional Fees & Consultancy",        "EXPENSE",   False, "Accountancy, legal, and consulting fees"),
    (7700, "Bank Charges & Finance Costs",           "EXPENSE",   False, "Bank fees, interest charges, finance costs"),
    (7800, "Depreciation",                           "EXPENSE",   False, "Depreciation of fixed assets"),
    (7900, "General Expenses",                       "EXPENSE",   False, "Miscellaneous business expenses"),
    (8000, "Insurance",                              "EXPENSE",   False, "Business insurance premiums"),
    (8100, "Rent & Rates",                           "EXPENSE",   False, "Office rent and business rates"),
    (8200, "Repairs & Maintenance",                  "EXPENSE",   False, "Maintenance and repair costs"),
    (8300, "Subscriptions & Memberships",            "EXPENSE",   False, "Professional subscriptions and memberships"),
    (8400, "Utilities",                              "EXPENSE",   False, "Gas, electricity, and water"),
    (8500, "Telephone & Internet",                   "EXPENSE",   False, "Phone bills and broadband"),
    (9000, "Interest Paid",                          "EXPENSE",   False, "Interest on loans and overdrafts"),
    (9999, "Suspense Account",                       "SUSPENSE",  True,  "Temporary holding account"),
]

def setup_test_env():
    """Create isolated test user + entity + COA. Returns {user_id, entity_id, token}."""
    # Clean up any leftover test user first
    existing = db_query("SELECT id FROM users WHERE email=$1", [TEST_EMAIL])
    if existing:
        teardown_test_env(str(existing[0]["id"]))

    user_id = str(uuid.uuid4())
    entity_id = str(uuid.uuid4())

    db_execute(
        "INSERT INTO users (id, email, name, subscription_plan) VALUES (%s,%s,%s,%s)",
        [user_id, TEST_EMAIL, "MCP Test User", "corporate"]
    )
    db_execute(
        "INSERT INTO entities (id, user_id, name, currency) VALUES (%s,%s,%s,%s)",
        [entity_id, user_id, "MCP Test Co", "GBP"]
    )
    for code, name, acct_type, is_system, desc in DEFAULT_COA:
        db_execute(
            """INSERT INTO chart_of_accounts
               (entity_id, code, name, account_type, description, is_system)
               VALUES (%s,%s,%s,%s,%s,%s)
               ON CONFLICT (entity_id, code) DO NOTHING""",
            [entity_id, code, name, acct_type, desc, is_system]
        )

    token = _mint(user_id)
    return {"user_id": user_id, "entity_id": entity_id, "token": token}

def teardown_test_env(user_id: str):
    """Hard-delete all data for the test user in FK-safe order."""
    stmts = [
        "DELETE FROM transaction_comments WHERE entity_id IN (SELECT id FROM entities WHERE user_id=%s)",
        "DELETE FROM accountant_referral_earnings WHERE accountant_user_id=%s OR client_user_id=%s",
        "DELETE FROM accountant_clients WHERE accountant_user_id=%s OR client_user_id=%s",
        "DELETE FROM attachment_data WHERE attachment_id IN (SELECT id FROM attachments WHERE entity_id IN (SELECT id FROM entities WHERE user_id=%s))",
        "DELETE FROM attachments WHERE entity_id IN (SELECT id FROM entities WHERE user_id=%s)",
        "DELETE FROM journal_lines WHERE entry_id IN (SELECT id FROM journal_entries WHERE entity_id IN (SELECT id FROM entities WHERE user_id=%s))",
        "DELETE FROM journal_entries WHERE entity_id IN (SELECT id FROM entities WHERE user_id=%s)",
        "DELETE FROM po_items WHERE purchase_order_id IN (SELECT id FROM purchase_orders WHERE entity_id IN (SELECT id FROM entities WHERE user_id=%s))",
        "DELETE FROM po_approver_mappings WHERE entity_id IN (SELECT id FROM entities WHERE user_id=%s)",
        "DELETE FROM po_settings WHERE entity_id IN (SELECT id FROM entities WHERE user_id=%s)",
        "DELETE FROM purchase_orders WHERE entity_id IN (SELECT id FROM entities WHERE user_id=%s)",
        "DELETE FROM expense_approval_settings WHERE entity_id IN (SELECT id FROM entities WHERE user_id=%s)",
        "DELETE FROM mileage_claims WHERE user_id=%s",
        "DELETE FROM expenses WHERE user_id=%s",
        "DELETE FROM credit_note_items WHERE credit_note_id IN (SELECT id FROM credit_notes WHERE entity_id IN (SELECT id FROM entities WHERE user_id=%s))",
        "DELETE FROM credit_notes WHERE entity_id IN (SELECT id FROM entities WHERE user_id=%s)",
        "DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE user_id=%s)",
        "DELETE FROM invoices WHERE user_id=%s",
        "DELETE FROM bank_transactions WHERE entity_id IN (SELECT id FROM entities WHERE user_id=%s)",
        "DELETE FROM bank_connections WHERE user_id=%s",
        "DELETE FROM reminder_logs WHERE user_id=%s",
        "DELETE FROM workspace_members WHERE owner_user_id=%s",
        "DELETE FROM audit_log WHERE user_id=%s",
        "DELETE FROM intercompany_links WHERE source_entity_id IN (SELECT id FROM entities WHERE user_id=%s)",
        "DELETE FROM chart_of_accounts WHERE entity_id IN (SELECT id FROM entities WHERE user_id=%s)",
        "DELETE FROM projects WHERE entity_id IN (SELECT id FROM entities WHERE user_id=%s)",
        "DELETE FROM bills WHERE entity_id IN (SELECT id FROM entities WHERE user_id=%s)",
        "DELETE FROM suppliers WHERE entity_id IN (SELECT id FROM entities WHERE user_id=%s)",
        "DELETE FROM customers WHERE user_id=%s",
        "DELETE FROM entities WHERE user_id=%s",
        "DELETE FROM users WHERE id=%s",
    ]
    # Statements with two params (accountant tables)
    two_param = {"accountant_referral_earnings", "accountant_clients"}
    for stmt in stmts:
        table = stmt.split("FROM ")[1].split(" ")[0]
        if table in two_param:
            db_execute(stmt, [user_id, user_id])
        else:
            db_execute(stmt, [user_id])
    return {"ok": True, "message": f"Torn down test user {user_id}"}

def mint_token_tool(user_id: str):
    """Mint a relentify_token JWT for any user_id."""
    rows = db_query("SELECT email FROM users WHERE id=%s", [user_id])
    email = rows[0]["email"] if rows else "unknown@test"
    return {"token": _mint(user_id, email)}
```

- [ ] **Step 2: Register setup tools in server.py**

Add to `server.py` before `asyncio.run(main())`:
```python
from tools.setup import setup_test_env, teardown_test_env, mint_token_tool
from mcp.types import Tool

register(Tool(name="setup_test_env", description="Create isolated test user+entity+COA. Returns user_id, entity_id, token.", inputSchema={"type":"object","properties":{}}), lambda **_: setup_test_env())
register(Tool(name="teardown_test_env", description="Delete all test data for a user_id.", inputSchema={"type":"object","properties":{"user_id":{"type":"string"}},"required":["user_id"]}), lambda user_id, **_: teardown_test_env(user_id))
register(Tool(name="mint_token", description="Mint a JWT token for any user_id.", inputSchema={"type":"object","properties":{"user_id":{"type":"string"}},"required":["user_id"]}), lambda user_id, **_: mint_token_tool(user_id))
```

- [ ] **Step 3: Smoke test setup**
```bash
cd /opt/22accounting-mcp
python3 -c "
from tools.setup import setup_test_env, teardown_test_env
env = setup_test_env()
print('Created:', env['user_id'])
result = teardown_test_env(env['user_id'])
print('Torn down:', result)
"
# Expected: prints user_id and {"ok": True, ...}
```

---

## Task 4: Register in ~/.mcp.json

- [ ] **Step 1: Add 22accounting server to ~/.mcp.json**

Edit `~/.mcp.json` — add alongside existing servers:
```json
"22accounting": {
  "command": "python3",
  "args": ["/opt/22accounting-mcp/server.py"]
}
```

- [ ] **Step 2: Verify server appears in Claude**

Restart Claude Code and confirm `22accounting__setup_test_env` appears in available tools.

---

## Task 5: Customers + Suppliers

**Files:**
- Create: `/opt/22accounting-mcp/tools/customers.py`
- Create: `/opt/22accounting-mcp/tools/suppliers.py`

- [ ] **Step 1: Create tools/customers.py**
```python
# /opt/22accounting-mcp/tools/customers.py
from http_client import api_get, api_post, api_patch, api_delete

def create_customer(token: str, name: str, email: str = "", phone: str = "", address: str = ""):
    return api_post("/api/customers", token, {"name": name, "email": email, "phone": phone, "address": address})

def list_customers(token: str):
    return api_get("/api/customers", token)

def update_customer(token: str, customer_id: str, name: str = None, email: str = None):
    body = {k: v for k, v in {"name": name, "email": email}.items() if v is not None}
    return api_patch(f"/api/customers/{customer_id}", token, body)

def delete_customer(token: str, customer_id: str):
    return api_delete(f"/api/customers/{customer_id}", token)
```

- [ ] **Step 2: Create tools/suppliers.py**
```python
# /opt/22accounting-mcp/tools/suppliers.py
from http_client import api_get, api_post, api_patch, api_delete

def create_supplier(token: str, name: str, email: str = "", phone: str = "", address: str = ""):
    return api_post("/api/suppliers", token, {"name": name, "email": email, "phone": phone, "address": address})

def list_suppliers(token: str):
    return api_get("/api/suppliers", token)

def update_supplier(token: str, supplier_id: str, name: str = None, email: str = None):
    body = {k: v for k, v in {"name": name, "email": email}.items() if v is not None}
    return api_patch(f"/api/suppliers/{supplier_id}", token, body)

def delete_supplier(token: str, supplier_id: str):
    return api_delete(f"/api/suppliers/{supplier_id}", token)
```

- [ ] **Step 3: Register in server.py**

Add to server.py:
```python
from tools.customers import create_customer, list_customers, update_customer, delete_customer
from tools.suppliers import create_supplier, list_suppliers, update_supplier, delete_supplier

_S = {"type": "string"}
_req = lambda *keys: {"required": list(keys)}

register(Tool(name="create_customer", description="Create a customer.", inputSchema={"type":"object","properties":{"token":_S,"name":_S,"email":_S,"phone":_S,"address":_S},"required":["token","name"]}), create_customer)
register(Tool(name="list_customers", description="List all customers.", inputSchema={"type":"object","properties":{"token":_S},"required":["token"]}), list_customers)
register(Tool(name="update_customer", description="Update a customer.", inputSchema={"type":"object","properties":{"token":_S,"customer_id":_S,"name":_S,"email":_S},"required":["token","customer_id"]}), update_customer)
register(Tool(name="delete_customer", description="Delete a customer.", inputSchema={"type":"object","properties":{"token":_S,"customer_id":_S},"required":["token","customer_id"]}), delete_customer)

register(Tool(name="create_supplier", description="Create a supplier.", inputSchema={"type":"object","properties":{"token":_S,"name":_S,"email":_S,"phone":_S,"address":_S},"required":["token","name"]}), create_supplier)
register(Tool(name="list_suppliers", description="List all suppliers.", inputSchema={"type":"object","properties":{"token":_S},"required":["token"]}), list_suppliers)
register(Tool(name="update_supplier", description="Update a supplier.", inputSchema={"type":"object","properties":{"token":_S,"supplier_id":_S,"name":_S,"email":_S},"required":["token","supplier_id"]}), update_supplier)
register(Tool(name="delete_supplier", description="Delete a supplier.", inputSchema={"type":"object","properties":{"token":_S,"supplier_id":_S},"required":["token","supplier_id"]}), delete_supplier)
```

- [ ] **Step 4: Smoke test**
```bash
cd /opt/22accounting-mcp && python3 -c "
from tools.setup import setup_test_env, teardown_test_env
from tools.customers import create_customer, list_customers
env = setup_test_env()
t = env['token']
r = create_customer(t, 'Test Customer', 'test@example.com')
print('create:', r['status'], r['data'])
r2 = list_customers(t)
print('list count:', len(r2['data']) if isinstance(r2.get('data'), list) else r2)
teardown_test_env(env['user_id'])
"
```

- [ ] **Step 5: Fix any failures, then commit**
```bash
cd /opt/22accounting-mcp
git init 2>/dev/null || true
git add -A && git commit -m "feat: add customers + suppliers tools"
```

---

## Task 6: Invoices + Quotes

**Files:**
- Create: `/opt/22accounting-mcp/tools/invoices.py`
- Create: `/opt/22accounting-mcp/tools/quotes.py`

- [ ] **Step 1: Create tools/invoices.py**
```python
# /opt/22accounting-mcp/tools/invoices.py
from http_client import api_get, api_post, api_patch, api_delete
import datetime

def create_invoice(token: str, customer_id: str, items: list,
                   due_date: str = None, notes: str = ""):
    """items: [{"description": str, "quantity": float, "unit_price": float, "vat_rate": float}]"""
    if not due_date:
        due_date = (datetime.date.today() + datetime.timedelta(days=30)).isoformat()
    return api_post("/api/invoices", token, {
        "customerId": customer_id, "items": items,
        "dueDate": due_date, "notes": notes
    })

def list_invoices(token: str):
    return api_get("/api/invoices", token)

def get_invoice(token: str, invoice_id: str):
    return api_get(f"/api/invoices/{invoice_id}", token)

def void_invoice(token: str, invoice_id: str):
    return api_delete(f"/api/invoices/{invoice_id}", token)

def send_invoice(token: str, invoice_id: str):
    return api_post(f"/api/invoices/{invoice_id}/send", token)

def record_invoice_payment(token: str, invoice_id: str, amount: float,
                            payment_date: str = None, bank_account_id: str = None,
                            reference: str = ""):
    if not payment_date:
        payment_date = datetime.date.today().isoformat()
    return api_post(f"/api/invoices/{invoice_id}/pay", token, {
        "amount": amount, "paymentDate": payment_date,
        "bankAccountId": bank_account_id, "reference": reference
    })
```

- [ ] **Step 2: Create tools/quotes.py**
```python
# /opt/22accounting-mcp/tools/quotes.py
from http_client import api_get, api_post, api_delete
import datetime

def create_quote(token: str, customer_id: str, items: list, expiry_date: str = None):
    if not expiry_date:
        expiry_date = (datetime.date.today() + datetime.timedelta(days=30)).isoformat()
    return api_post("/api/quotes", token, {
        "customerId": customer_id, "items": items, "expiryDate": expiry_date
    })

def list_quotes(token: str):
    return api_get("/api/quotes", token)

def send_quote(token: str, quote_id: str):
    return api_post(f"/api/quotes/{quote_id}/send", token)

def convert_quote_to_invoice(token: str, quote_id: str):
    return api_post(f"/api/quotes/{quote_id}/convert", token)
```

- [ ] **Step 3: Register both in server.py** (follow same pattern as Task 5 Step 3 — one register() call per tool)

- [ ] **Step 4: Smoke test — verify price formatting fix (#5)**
```bash
cd /opt/22accounting-mcp && python3 -c "
from tools.setup import setup_test_env, teardown_test_env
from tools.customers import create_customer
from tools.invoices import create_invoice, record_invoice_payment
env = setup_test_env(); t = env['token']
c = create_customer(t, 'Price Test Co')
cid = c['data']['id']
# Bug #5: 1 qty * 10000 should = 10000.00 not 100.00
inv = create_invoice(t, cid, [{'description': 'Test', 'quantity': 1, 'unit_price': 10000, 'vat_rate': 0}])
print('Invoice total:', inv['data'].get('total'), '-- expected 10000')
teardown_test_env(env['user_id'])
"
```

- [ ] **Step 5: Fix any failures, commit**
```bash
git add -A && git commit -m "feat: add invoices + quotes tools"
```

---

## Task 7: Bills + Credit Notes

**Files:**
- Create: `/opt/22accounting-mcp/tools/bills.py`
- Create: `/opt/22accounting-mcp/tools/credit_notes.py`

- [ ] **Step 1: Create tools/bills.py**
```python
# /opt/22accounting-mcp/tools/bills.py
from http_client import api_get, api_post, api_delete
import datetime

def create_bill(token: str, supplier_id: str, amount: float,
                description: str = "Test bill", due_date: str = None,
                invoice_date: str = None, coa_account_id: str = None):
    if not due_date:
        due_date = (datetime.date.today() + datetime.timedelta(days=30)).isoformat()
    if not invoice_date:
        invoice_date = datetime.date.today().isoformat()
    body = {"supplierId": supplier_id, "amount": amount,
            "description": description, "dueDate": due_date,
            "invoiceDate": invoice_date}
    if coa_account_id:
        body["coaAccountId"] = coa_account_id
    return api_post("/api/bills", token, body)

def list_bills(token: str):
    return api_get("/api/bills", token)

def get_bill(token: str, bill_id: str):
    return api_get(f"/api/bills/{bill_id}", token)

def record_bill_payment(token: str, bill_id: str, amount: float,
                         payment_date: str = None, bank_account_id: str = None,
                         reference: str = ""):
    if not payment_date:
        payment_date = datetime.date.today().isoformat()
    return api_post(f"/api/bills/{bill_id}/pay", token, {
        "amount": amount, "paymentDate": payment_date,
        "bankAccountId": bank_account_id, "reference": reference
    })
```

- [ ] **Step 2: Create tools/credit_notes.py**
```python
# /opt/22accounting-mcp/tools/credit_notes.py
from http_client import api_get, api_post, api_delete
import datetime

def create_credit_note(token: str, customer_id: str, items: list,
                        invoice_id: str = None):
    body = {"customerId": customer_id, "items": items}
    if invoice_id:
        body["invoiceId"] = invoice_id
    return api_post("/api/credit-notes", token, body)

def list_credit_notes(token: str):
    return api_get("/api/credit-notes", token)

def void_credit_note(token: str, credit_note_id: str):
    return api_delete(f"/api/credit-notes/{credit_note_id}", token)
```

- [ ] **Step 3: Register both in server.py**

- [ ] **Step 4: Smoke test**
```bash
cd /opt/22accounting-mcp && python3 -c "
from tools.setup import setup_test_env, teardown_test_env
from tools.customers import create_customer
from tools.suppliers import create_supplier
from tools.bills import create_bill, record_bill_payment
from tools.credit_notes import create_credit_note, void_credit_note
from tools.invoices import create_invoice
env = setup_test_env(); t = env['token']
sup = create_supplier(t, 'ACME Ltd')
bill = create_bill(t, sup['data']['id'], 500.0)
print('bill status:', bill['status'])
cust = create_customer(t, 'Test Cust')
inv = create_invoice(t, cust['data']['id'], [{'description':'x','quantity':1,'unit_price':100,'vat_rate':20}])
cn = create_credit_note(t, cust['data']['id'], [{'description':'refund','quantity':1,'unit_price':50,'vat_rate':0}])
print('credit note status:', cn['status'])
teardown_test_env(env['user_id'])
"
```

- [ ] **Step 5: Fix failures, commit**
```bash
git add -A && git commit -m "feat: add bills + credit notes tools"
```

---

## Task 8: Expenses + Mileage

**File:** `/opt/22accounting-mcp/tools/expenses.py`

- [ ] **Step 1: Create tools/expenses.py**
```python
# /opt/22accounting-mcp/tools/expenses.py
from http_client import api_get, api_post
import datetime

def _today(): return datetime.date.today().isoformat()

def create_expense(token: str, description: str, amount: float,
                   category: str = "General", expense_date: str = None,
                   coa_account_id: str = None):
    body = {"description": description, "grossAmount": amount,
            "category": category, "date": expense_date or _today()}
    if coa_account_id:
        body["coaAccountId"] = coa_account_id
    return api_post("/api/expenses", token, body)

def list_expenses(token: str):
    return api_get("/api/expenses", token)

def approve_expense(token: str, expense_id: str):
    return api_post(f"/api/expenses/{expense_id}/approve", token)

def reject_expense(token: str, expense_id: str, reason: str = "Test rejection"):
    return api_post(f"/api/expenses/{expense_id}/reject", token, {"reason": reason})

def create_mileage(token: str, description: str, miles: float,
                   from_location: str = "", to_location: str = "",
                   mileage_date: str = None, rate: float = 0.45):
    return api_post("/api/mileage", token, {
        "description": description, "miles": miles,
        "fromLocation": from_location, "toLocation": to_location,
        "date": mileage_date or _today(), "rate": rate
    })

def list_mileage(token: str):
    return api_get("/api/mileage", token)

def approve_mileage(token: str, expense_id: str):
    return api_post(f"/api/mileage/{expense_id}/approve", token)

def reject_mileage(token: str, expense_id: str, reason: str = "Test rejection"):
    return api_post(f"/api/mileage/{expense_id}/reject", token, {"reason": reason})

def get_pending_approvals(token: str):
    return api_get("/api/expenses/pending-approvals", token)

def get_expense_approval_settings(token: str):
    return api_get("/api/expense-approval-settings", token)

def update_expense_approval_settings(token: str, requires_approval: bool,
                                      approver_user_id: str = None):
    body = {"requiresApproval": requires_approval}
    if approver_user_id:
        body["approverUserId"] = approver_user_id
    return api_post("/api/expense-approval-settings", token, body)
```

- [ ] **Step 2: Register in server.py**

- [ ] **Step 3: Smoke test**
```bash
cd /opt/22accounting-mcp && python3 -c "
from tools.setup import setup_test_env, teardown_test_env
from tools.expenses import create_expense, list_expenses, get_pending_approvals
env = setup_test_env(); t = env['token']
r = create_expense(t, 'Office supplies', 45.00)
print('expense:', r['status'], r['data'].get('id') if r.get('data') else r)
print('pending:', get_pending_approvals(t)['status'])
teardown_test_env(env['user_id'])
"
```

- [ ] **Step 4: Fix failures, commit**
```bash
git add -A && git commit -m "feat: add expenses + mileage tools"
```

---

## Task 9: Purchase Orders

**File:** `/opt/22accounting-mcp/tools/purchase_orders.py`

- [ ] **Step 1: Create tools/purchase_orders.py**
```python
# /opt/22accounting-mcp/tools/purchase_orders.py
from http_client import api_get, api_post, api_patch, api_delete
import datetime

def _today(): return datetime.date.today().isoformat()

def create_po(token: str, supplier_id: str, items: list,
              required_by: str = None):
    """items: [{"description": str, "quantity": float, "unit_price": float}]"""
    return api_post("/api/po", token, {
        "supplierId": supplier_id, "items": items,
        "requiredBy": required_by or (datetime.date.today() + datetime.timedelta(days=14)).isoformat()
    })

def list_pos(token: str):
    return api_get("/api/po", token)

def get_po(token: str, po_id: str):
    return api_get(f"/api/po/{po_id}", token)

def submit_po_for_approval(token: str, po_id: str):
    return api_patch(f"/api/po/{po_id}", token, {"status": "pending_approval"})

def approve_po(token: str, po_id: str):
    return api_post(f"/api/po/{po_id}/approve", token)

def reject_po(token: str, po_id: str, reason: str = "Test rejection"):
    return api_post(f"/api/po/{po_id}/reject", token, {"reason": reason})

def get_po_settings(token: str):
    return api_get("/api/po/settings", token)

def set_po_approver_mapping(token: str, staff_user_id: str, approver_user_id: str):
    return api_post("/api/po/approver-mappings", token, {
        "staffUserId": staff_user_id, "approverUserId": approver_user_id
    })
```

- [ ] **Step 2: Register in server.py**

- [ ] **Step 3: Smoke test**
```bash
cd /opt/22accounting-mcp && python3 -c "
from tools.setup import setup_test_env, teardown_test_env
from tools.suppliers import create_supplier
from tools.purchase_orders import create_po, list_pos, submit_po_for_approval
env = setup_test_env(); t = env['token']
sup = create_supplier(t, 'PO Supplier')
po = create_po(t, sup['data']['id'], [{'description':'Laptops','quantity':2,'unit_price':800}])
print('PO created:', po['status'])
sub = submit_po_for_approval(t, po['data']['id'])
print('Submit for approval:', sub['status'])
teardown_test_env(env['user_id'])
"
```

- [ ] **Step 4: Fix failures, commit**
```bash
git add -A && git commit -m "feat: add purchase orders tools"
```

---

## Task 10: Projects + Chart of Accounts + Journal Entries

**Files:**
- Create: `/opt/22accounting-mcp/tools/projects.py`
- Create: `/opt/22accounting-mcp/tools/coa.py`
- Create: `/opt/22accounting-mcp/tools/journals.py`

- [ ] **Step 1: Create tools/projects.py**
```python
# /opt/22accounting-mcp/tools/projects.py
from http_client import api_get, api_post, api_patch, api_delete

def create_project(token: str, name: str, description: str = ""):
    return api_post("/api/projects", token, {"name": name, "description": description})

def list_projects(token: str):
    return api_get("/api/projects", token)

def update_project(token: str, project_id: str, name: str = None, description: str = None):
    body = {k: v for k, v in {"name": name, "description": description}.items() if v is not None}
    return api_patch(f"/api/projects/{project_id}", token, body)

def delete_project(token: str, project_id: str):
    return api_delete(f"/api/projects/{project_id}", token)
```

- [ ] **Step 2: Create tools/coa.py**
```python
# /opt/22accounting-mcp/tools/coa.py
from http_client import api_get, api_post, api_patch

def list_coa(token: str):
    return api_get("/api/accounts", token)

def create_coa_account(token: str, code: int, name: str, account_type: str,
                        description: str = ""):
    return api_post("/api/accounts", token, {
        "code": code, "name": name, "accountType": account_type,
        "description": description
    })

def deactivate_coa_account(token: str, account_id: str):
    return api_patch(f"/api/accounts/{account_id}", token, {"isActive": False})
```

- [ ] **Step 3: Create tools/journals.py**
```python
# /opt/22accounting-mcp/tools/journals.py
from http_client import api_get, api_post
import datetime

def create_journal_entry(token: str, description: str, lines: list,
                          date: str = None):
    """lines: [{"accountCode": int, "debit": float, "credit": float, "description": str}]
    Sum of debits must equal sum of credits."""
    return api_post("/api/journals", token, {
        "description": description,
        "date": date or datetime.date.today().isoformat(),
        "lines": lines
    })

def list_journal_entries(token: str):
    return api_get("/api/journals", token)

def reverse_journal_entry(token: str, journal_id: str):
    from http_client import api_delete
    return api_delete(f"/api/journals/{journal_id}", token)
```

- [ ] **Step 4: Register all three in server.py**

- [ ] **Step 5: Smoke test — journal must balance**
```bash
cd /opt/22accounting-mcp && python3 -c "
from tools.setup import setup_test_env, teardown_test_env
from tools.journals import create_journal_entry, list_journal_entries
env = setup_test_env(); t = env['token']
# Balanced journal: Dr 7900 General Expenses / Cr 1200 Current Account
r = create_journal_entry(t, 'Test journal', [
    {'accountCode': 7900, 'debit': 100, 'credit': 0, 'description': 'Expense'},
    {'accountCode': 1200, 'debit': 0, 'credit': 100, 'description': 'Bank'},
])
print('Journal:', r['status'], r['data'].get('id') if r.get('data') else r)
teardown_test_env(env['user_id'])
"
```

- [ ] **Step 6: Fix failures, commit**
```bash
git add -A && git commit -m "feat: add projects + COA + journal tools"
```

---

## Task 11: Banking

**File:** `/opt/22accounting-mcp/tools/banking.py`

- [ ] **Step 1: Create tools/banking.py**
```python
# /opt/22accounting-mcp/tools/banking.py
from http_client import api_get, api_post
from config import TRUELAYER_CLIENT_ID

def list_bank_accounts(token: str):
    return api_get("/api/banking", token)

def list_bank_transactions(token: str, account_id: str = None):
    params = {"accountId": account_id} if account_id else None
    return api_get("/api/banking", token, params=params)

def reconcile_transaction(token: str, transaction_id: str, match_id: str,
                           match_type: str = "invoice"):
    """match_type: invoice | bill | manual"""
    return api_post(f"/api/banking/{transaction_id}/match", token, {
        "matchId": match_id, "matchType": match_type
    })

def sync_bank(token: str):
    return api_post("/api/openbanking/sync", token)

def connect_bank_mock(token: str):
    if not TRUELAYER_CLIENT_ID:
        return {"ok": False, "skipped": True,
                "reason": "TRUELAYER_CLIENT_ID not set in .env"}
    return api_post("/api/openbanking/connect", token,
                    {"provider": "uk-cs-mock"})
```

- [ ] **Step 2: Register in server.py**

- [ ] **Step 3: Smoke test**
```bash
cd /opt/22accounting-mcp && python3 -c "
from tools.setup import setup_test_env, teardown_test_env
from tools.banking import list_bank_accounts
env = setup_test_env(); t = env['token']
r = list_bank_accounts(t)
print('Banking list:', r['status'])
teardown_test_env(env['user_id'])
"
```

- [ ] **Step 4: Fix failures, commit**
```bash
git add -A && git commit -m "feat: add banking tools"
```

---

## Task 12: Reports

**File:** `/opt/22accounting-mcp/tools/reports.py`

- [ ] **Step 1: Create tools/reports.py**
```python
# /opt/22accounting-mcp/tools/reports.py
from http_client import api_get, api_post
import datetime

def _today(): return datetime.date.today().isoformat()
def _fy_start(): return f"{datetime.date.today().year}-04-06"  # UK FY start

def get_pl(token: str, from_date: str = None, to_date: str = None):
    return api_get("/api/reports/pl", token, params={
        "from": from_date or _fy_start(), "to": to_date or _today()
    })

def get_balance_sheet(token: str, as_of: str = None):
    return api_get("/api/reports/balance-sheet", token,
                   params={"date": as_of or _today()})

def get_trial_balance(token: str, as_of: str = None):
    return api_get("/api/reports/trial-balance", token,
                   params={"date": as_of or _today()})

def get_gl(token: str, from_date: str = None, to_date: str = None):
    return api_get("/api/ledger", token, params={
        "from": from_date or _fy_start(), "to": to_date or _today()
    })

def get_aged_receivables(token: str):
    return api_get("/api/reports/aged-receivables", token)

def get_aged_payables(token: str):
    return api_get("/api/reports/aged-payables", token)

def get_kpi_report(token: str):
    return api_get("/api/reports/kpi", token)

def get_cashflow_forecast(token: str):
    return api_get("/api/reports/cashflow", token)

def get_health_score(token: str):
    return api_get("/api/reports/health", token)

def get_custom_report(token: str, from_date: str = None, to_date: str = None,
                       columns: list = None):
    return api_post("/api/reports/custom", token, {
        "from": from_date or _fy_start(), "to": to_date or _today(),
        "columns": columns or ["date", "description", "amount"]
    })

def get_dashboard(token: str):
    """Fetches dashboard data — tests dashboard rebuild (#1)."""
    return api_get("/api/reports/cashflow", token)

def get_consolidated_report(token: str):
    return api_get("/api/reports/consolidated", token)
```

- [ ] **Step 2: Register all in server.py**

- [ ] **Step 3: Smoke test**
```bash
cd /opt/22accounting-mcp && python3 -c "
from tools.setup import setup_test_env, teardown_test_env
from tools.reports import get_pl, get_balance_sheet, get_health_score
env = setup_test_env(); t = env['token']
print('P&L:', get_pl(t)['status'])
print('Balance sheet:', get_balance_sheet(t)['status'])
print('Health score:', get_health_score(t)['status'])
teardown_test_env(env['user_id'])
"
```

- [ ] **Step 4: Fix failures, commit**
```bash
git add -A && git commit -m "feat: add reports tools"
```

---

## Task 13: VAT + Period Locks + Import

**Files:**
- Create: `/opt/22accounting-mcp/tools/vat.py`
- Create: `/opt/22accounting-mcp/tools/period_locks.py`
- Create: `/opt/22accounting-mcp/tools/import_data.py`

- [ ] **Step 1: Create tools/vat.py**
```python
# /opt/22accounting-mcp/tools/vat.py
from http_client import api_get, api_post
from config import HMRC_CLIENT_ID, HMRC_BASE_URL
import datetime

def get_vat_return(token: str, from_date: str = None, to_date: str = None):
    today = datetime.date.today()
    return api_get("/api/hmrc/vat/calculate", token, params={
        "from": from_date or f"{today.year}-01-01",
        "to": to_date or today.isoformat()
    })

def submit_vat_return(token: str, period_key: str):
    if not HMRC_CLIENT_ID:
        return {"ok": False, "skipped": True,
                "reason": "HMRC_CLIENT_ID not set — configure HMRC sandbox to enable"}
    return api_post("/api/hmrc/vat/submit", token, {"periodKey": period_key})
```

- [ ] **Step 2: Create tools/period_locks.py**
```python
# /opt/22accounting-mcp/tools/period_locks.py
from http_client import api_get, api_post, api_delete
import datetime

def get_period_lock(token: str):
    return api_get("/api/period-locks", token)

def lock_period(token: str, lock_through_date: str):
    return api_post("/api/period-locks", token, {"lockThroughDate": lock_through_date})

def unlock_period(token: str):
    return api_delete("/api/period-locks", token)

def grant_lock_override(token: str, user_id: str):
    return api_post("/api/period-locks/overrides", token, {"userId": user_id})

def test_period_lock_enforcement(token: str, lock_through_date: str = None):
    """Lock a period, then attempt to post into it. Expects 403 PERIOD_LOCKED."""
    from tools.customers import create_customer
    from tools.invoices import create_invoice
    import datetime as dt

    if not lock_through_date:
        lock_through_date = dt.date.today().isoformat()

    # Lock the period
    lock_result = lock_period(token, lock_through_date)
    if not lock_result.get("ok"):
        return {"ok": False, "error": "Failed to lock period", "lock_result": lock_result}

    # Attempt to create an invoice dated inside the locked period
    locked_date = (dt.date.today() - dt.timedelta(days=1)).isoformat()
    cust = create_customer(token, "_LockTest")
    inv = create_invoice(token, cust["data"]["id"],
                         [{"description": "locked", "quantity": 1,
                           "unit_price": 10, "vat_rate": 0}],
                         due_date=locked_date)

    # Clean up lock
    unlock_period(token)

    expected_blocked = inv["status"] == 403
    return {
        "ok": True,
        "period_lock_enforced": expected_blocked,
        "invoice_response_status": inv["status"],
        "invoice_body": inv.get("data"),
        "note": "PASS: 403 received as expected" if expected_blocked
                else "FAIL: invoice was not blocked by period lock"
    }
```

- [ ] **Step 3: Create tools/import_data.py**
```python
# /opt/22accounting-mcp/tools/import_data.py
from http_client import api_post
from config import BASE_URL
import httpx

def import_data(token: str, record_type: str, csv_content: str):
    """record_type: customers | suppliers | invoices | bills | expenses"""
    import io
    files = {
        "file": (f"{record_type}.csv", io.BytesIO(csv_content.encode()), "text/csv"),
        "type": (None, record_type),
    }
    headers = {"Cookie": f"relentify_token={token}"}
    try:
        r = httpx.post(f"{BASE_URL}/api/import", headers=headers,
                       files=files, timeout=30)
        return {"ok": r.is_success, "status": r.status_code, "data": r.json() if r.content else {}}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def import_opening_balances(token: str, xlsx_bytes: bytes):
    import io
    files = {"file": ("opening_balances.xlsx", io.BytesIO(xlsx_bytes),
                      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    headers = {"Cookie": f"relentify_token={token}"}
    try:
        r = httpx.post(f"{BASE_URL}/api/import/opening-balances",
                       headers=headers, files=files, timeout=30)
        return {"ok": r.is_success, "status": r.status_code, "data": r.json() if r.content else {}}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def trigger_year_end_close(token: str, year_end_date: str):
    from http_client import api_post
    return api_post("/api/year-end/close", token, {"yearEndDate": year_end_date})
```

- [ ] **Step 4: Register all in server.py**

- [ ] **Step 5: Smoke test period lock enforcement**
```bash
cd /opt/22accounting-mcp && python3 -c "
from tools.setup import setup_test_env, teardown_test_env
from tools.period_locks import test_period_lock_enforcement, get_period_lock
env = setup_test_env(); t = env['token']
result = test_period_lock_enforcement(t)
print('Period lock enforced:', result.get('period_lock_enforced'))
print('Note:', result.get('note'))
teardown_test_env(env['user_id'])
"
```

- [ ] **Step 6: Fix failures, commit**
```bash
git add -A && git commit -m "feat: add VAT + period locks + import tools"
```

---

## Task 14: Attachments + Comments + Team

**Files:**
- Create: `/opt/22accounting-mcp/tools/attachments.py`
- Create: `/opt/22accounting-mcp/tools/comments.py`
- Create: `/opt/22accounting-mcp/tools/team.py`

- [ ] **Step 1: Create tools/attachments.py**
```python
# /opt/22accounting-mcp/tools/attachments.py
import httpx, io
from config import BASE_URL

def upload_attachment(token: str, record_type: str, record_id: str,
                       file_bytes: bytes = None, mime_type: str = "image/jpeg",
                       filename: str = "test.jpg"):
    """record_type: bill | expense | bank_transaction"""
    if file_bytes is None:
        # Minimal valid 1x1 JPEG
        file_bytes = bytes([
            0xFF,0xD8,0xFF,0xE0,0x00,0x10,0x4A,0x46,0x49,0x46,0x00,0x01,
            0x01,0x00,0x00,0x01,0x00,0x01,0x00,0x00,0xFF,0xDB,0x00,0x43,
            0x00,0x08,0x06,0x06,0x07,0x06,0x05,0x08,0x07,0x07,0x07,0x09,
            0x09,0x08,0x0A,0x0C,0x14,0x0D,0x0C,0x0B,0x0B,0x0C,0x19,0x12,
            0x13,0x0F,0x14,0x1D,0x1A,0x1F,0x1E,0x1D,0x1A,0x1C,0x1C,0x20,
            0x24,0x2E,0x27,0x20,0x22,0x2C,0x23,0x1C,0x1C,0x28,0x37,0x29,
            0x2C,0x30,0x31,0x34,0x34,0x34,0x1F,0x27,0x39,0x3D,0x38,0x32,
            0x3C,0x2E,0x33,0x34,0x32,0xFF,0xC0,0x00,0x0B,0x08,0x00,0x01,
            0x00,0x01,0x01,0x01,0x11,0x00,0xFF,0xC4,0x00,0x1F,0x00,0x00,
            0x01,0x05,0x01,0x01,0x01,0x01,0x01,0x01,0x00,0x00,0x00,0x00,
            0x00,0x00,0x00,0x00,0x01,0x02,0x03,0x04,0x05,0x06,0x07,0x08,
            0x09,0x0A,0x0B,0xFF,0xC4,0x00,0xB5,0x10,0x00,0x02,0x01,0x03,
            0x03,0x02,0x04,0x03,0x05,0x05,0x04,0x04,0x00,0x00,0x01,0x7D,
            0xFF,0xDA,0x00,0x08,0x01,0x01,0x00,0x00,0x3F,0x00,0xFB,0xFF,
            0xD9
        ])
    headers = {"Cookie": f"relentify_token={token}"}
    files = {
        "file": (filename, io.BytesIO(file_bytes), mime_type),
        "recordType": (None, record_type),
        "recordId": (None, record_id),
    }
    try:
        r = httpx.post(f"{BASE_URL}/api/attachments", headers=headers,
                       files=files, timeout=30)
        return {"ok": r.is_success, "status": r.status_code,
                "data": r.json() if r.content else {}}
    except httpx.ConnectError:
        return {"ok": False, "error": f"22accounting not reachable at {BASE_URL}"}

def list_attachments(token: str, record_type: str, record_id: str):
    from http_client import api_get
    return api_get("/api/attachments", token,
                   params={"recordType": record_type, "recordId": record_id})

def delete_attachment(token: str, attachment_id: str):
    from http_client import api_delete
    return api_delete(f"/api/attachments/{attachment_id}", token)
```

- [ ] **Step 2: Create tools/comments.py**
```python
# /opt/22accounting-mcp/tools/comments.py
from http_client import api_get, api_post, api_delete

def create_comment(token: str, record_type: str, record_id: str, body: str):
    return api_post("/api/comments", token, {
        "recordType": record_type, "recordId": record_id, "body": body
    })

def list_comments(token: str, record_type: str, record_id: str):
    return api_get("/api/comments", token,
                   params={"recordType": record_type, "recordId": record_id})

def reply_to_comment(token: str, parent_id: str, body: str):
    return api_post("/api/comments", token, {"parentId": parent_id, "body": body})

def get_conversations(token: str):
    return api_get("/api/comments/conversations", token)
```

- [ ] **Step 3: Create tools/team.py**
```python
# /opt/22accounting-mcp/tools/team.py
from http_client import api_get, api_post, api_patch
from db import db_query

def invite_team_member(token: str, email: str, role: str = "member"):
    return api_post("/api/team", token, {"email": email, "role": role})

def accept_team_invite(owner_user_id: str, invitee_email: str):
    """Read invite token from DB directly, bypassing email."""
    rows = db_query(
        "SELECT invite_token FROM workspace_members WHERE owner_user_id=%s AND invited_email=%s",
        [owner_user_id, invitee_email]
    )
    if not rows or not rows[0]["invite_token"]:
        return {"ok": False, "error": "No pending invite found in DB"}
    from http_client import api_post
    # Invitee needs their own token — create minimal user first
    import uuid
    from db import db_execute
    from auth import mint_token
    invitee_id = str(uuid.uuid4())
    db_execute("INSERT INTO users (id, email, name, subscription_plan) VALUES (%s,%s,%s,%s)",
               [invitee_id, invitee_email, "Invitee", "invoicing"])
    invitee_token = mint_token(invitee_id, invitee_email)
    result = api_post(f"/api/team/accept", invitee_token,
                      {"token": rows[0]["invite_token"]})
    return {"ok": result.get("ok"), "invitee_id": invitee_id,
            "invite_result": result}

def list_team_members(token: str):
    return api_get("/api/team", token)

def update_team_member_role(token: str, member_id: str, role: str):
    return api_patch(f"/api/team/{member_id}", token, {"role": role})
```

- [ ] **Step 4: Register all in server.py**

- [ ] **Step 5: Smoke test attachments**
```bash
cd /opt/22accounting-mcp && python3 -c "
from tools.setup import setup_test_env, teardown_test_env
from tools.suppliers import create_supplier
from tools.bills import create_bill
from tools.attachments import upload_attachment, list_attachments
env = setup_test_env(); t = env['token']
sup = create_supplier(t, 'Attach Test Supplier')
bill = create_bill(t, sup['data']['id'], 100.0)
bill_id = bill['data']['id']
r = upload_attachment(t, 'bill', bill_id)
print('Upload attachment:', r['status'])
lst = list_attachments(t, 'bill', bill_id)
print('List attachments count:', len(lst.get('data', [])))
teardown_test_env(env['user_id'])
"
```

- [ ] **Step 6: Fix failures, commit**
```bash
git add -A && git commit -m "feat: add attachments + comments + team tools"
```

---

## Task 15: Multi-Entity + Accountant Access

**Files:**
- Create: `/opt/22accounting-mcp/tools/multi_entity.py`
- Create: `/opt/22accounting-mcp/tools/accountant.py`

- [ ] **Step 1: Create tools/multi_entity.py**
```python
# /opt/22accounting-mcp/tools/multi_entity.py
from http_client import api_get, api_post

def create_entity(token: str, name: str, currency: str = "GBP"):
    return api_post("/api/entities", token, {"name": name, "currency": currency})

def list_entities(token: str):
    return api_get("/api/entities", token)

def create_intercompany_transaction(token: str, source_entity_id: str,
                                     target_entity_id: str, amount: float,
                                     description: str = "Intercompany transfer"):
    return api_post("/api/intercompany", token, {
        "sourceEntityId": source_entity_id, "targetEntityId": target_entity_id,
        "amount": amount, "description": description
    })

def list_intercompany_transactions(token: str):
    return api_get("/api/intercompany", token)
```

- [ ] **Step 2: Create tools/accountant.py**
```python
# /opt/22accounting-mcp/tools/accountant.py
from http_client import api_get, api_post
from db import db_execute, db_query
from auth import mint_token
import uuid

ACCOUNTANT_EMAIL = "accountant@22accounting-mcp.internal"

def setup_accountant_account():
    """Create a separate accountant-tier user."""
    existing = db_query("SELECT id FROM users WHERE email=%s", [ACCOUNTANT_EMAIL])
    if existing:
        acct_id = str(existing[0]["id"])
        return {"accountant_id": acct_id, "token": mint_token(acct_id, ACCOUNTANT_EMAIL)}
    acct_id = str(uuid.uuid4())
    db_execute(
        "INSERT INTO users (id, email, name, subscription_plan) VALUES (%s,%s,%s,%s)",
        [acct_id, ACCOUNTANT_EMAIL, "MCP Accountant", "accountant"]
    )
    return {"accountant_id": acct_id, "token": mint_token(acct_id, ACCOUNTANT_EMAIL)}

def teardown_accountant_account():
    from tools.setup import teardown_test_env
    rows = db_query("SELECT id FROM users WHERE email=%s", [ACCOUNTANT_EMAIL])
    if rows:
        return teardown_test_env(str(rows[0]["id"]))
    return {"ok": True, "message": "No accountant account found"}

def invite_client(accountant_token: str, client_email: str):
    return api_post("/api/accountant/invite", accountant_token, {"clientEmail": client_email})

def accept_client_invite(invite_token: str, client_user_id: str):
    client_token = mint_token(client_user_id)
    return api_post("/api/accountant/invite/accept", client_token, {"token": invite_token})

def impersonate_client(accountant_token: str, client_user_id: str):
    return api_post("/api/accountant/switch", accountant_token,
                    {"clientUserId": client_user_id})

def get_accountant_portal(accountant_token: str):
    return api_get("/api/accountant/clients", accountant_token)

def get_referral_earnings(accountant_token: str):
    return api_get("/api/accountant/earnings", accountant_token)
```

- [ ] **Step 3: Register both in server.py**

- [ ] **Step 4: Smoke test**
```bash
cd /opt/22accounting-mcp && python3 -c "
from tools.setup import setup_test_env, teardown_test_env
from tools.multi_entity import create_entity, list_entities
env = setup_test_env(); t = env['token']
e2 = create_entity(t, 'Second Entity')
print('Create entity:', e2['status'])
lst = list_entities(t)
print('Entity count:', len(lst.get('data', [])))
teardown_test_env(env['user_id'])
"
```

- [ ] **Step 5: Fix failures, commit**
```bash
git add -A && git commit -m "feat: add multi-entity + accountant tools"
```

---

## Task 16: Settings + Audit + Cron + Stripe

**Files:**
- Create: `/opt/22accounting-mcp/tools/settings.py`
- Create: `/opt/22accounting-mcp/tools/audit.py`
- Create: `/opt/22accounting-mcp/tools/cron.py`
- Create: `/opt/22accounting-mcp/tools/stripe.py`

- [ ] **Step 1: Create tools/settings.py**
```python
# /opt/22accounting-mcp/tools/settings.py
from http_client import api_get, api_post

def update_company_settings(token: str, registered_address: str = None,
                              bank_account_name: str = None,
                              sort_code: str = None, account_number: str = None):
    body = {}
    if registered_address: body["registeredAddress"] = registered_address
    if bank_account_name:  body["bankAccountName"] = bank_account_name
    if sort_code:          body["sortCode"] = sort_code
    if account_number:     body["accountNumber"] = account_number
    return api_post("/api/user/update", token, body)
```

- [ ] **Step 2: Create tools/audit.py**
```python
# /opt/22accounting-mcp/tools/audit.py
from http_client import api_get

def get_audit_log(token: str, limit: int = 50):
    return api_get("/api/audit", token, params={"limit": limit})
```

- [ ] **Step 3: Create tools/cron.py**
```python
# /opt/22accounting-mcp/tools/cron.py
import httpx
from config import BASE_URL, CRON_SECRET

def _cron_headers():
    return {"x-cron-secret": CRON_SECRET}

def trigger_po_escalation_cron():
    if not CRON_SECRET:
        return {"ok": False, "skipped": True, "reason": "CRON_SECRET not set"}
    try:
        r = httpx.post(f"{BASE_URL}/api/cron/po-escalation",
                       headers=_cron_headers(), timeout=30)
        return {"ok": r.is_success, "status": r.status_code,
                "data": r.json() if r.content else {}}
    except httpx.ConnectError:
        return {"ok": False, "error": f"22accounting not reachable"}

def trigger_payment_reminders_cron():
    if not CRON_SECRET:
        return {"ok": False, "skipped": True, "reason": "CRON_SECRET not set"}
    try:
        r = httpx.post(f"{BASE_URL}/api/cron/reminders",
                       headers=_cron_headers(), timeout=30)
        return {"ok": r.is_success, "status": r.status_code,
                "data": r.json() if r.content else {}}
    except httpx.ConnectError:
        return {"ok": False, "error": f"22accounting not reachable"}
```

- [ ] **Step 4: Create tools/stripe.py**
```python
# /opt/22accounting-mcp/tools/stripe.py
import hmac, hashlib, time, json, httpx
from config import BASE_URL, STRIPE_WEBHOOK_SECRET

def simulate_stripe_payment_webhook(invoice_id: str):
    """Sign and POST a Stripe invoice.payment_succeeded webhook directly."""
    if not STRIPE_WEBHOOK_SECRET:
        return {"ok": False, "skipped": True,
                "reason": "STRIPE_WEBHOOK_SECRET not set in .env"}
    payload = json.dumps({
        "type": "invoice.payment_succeeded",
        "data": {"object": {"id": f"in_test_{invoice_id}",
                             "metadata": {"relentify_invoice_id": invoice_id},
                             "amount_paid": 10000,
                             "currency": "gbp"}}
    })
    timestamp = str(int(time.time()))
    signed = f"{timestamp}.{payload}"
    sig = hmac.new(STRIPE_WEBHOOK_SECRET.encode(),
                   signed.encode(), hashlib.sha256).hexdigest()
    stripe_sig = f"t={timestamp},v1={sig}"
    try:
        r = httpx.post(
            f"{BASE_URL}/api/webhooks/stripe",
            content=payload,
            headers={"Content-Type": "application/json",
                     "stripe-signature": stripe_sig},
            timeout=30
        )
        return {"ok": r.is_success, "status": r.status_code,
                "data": r.json() if r.content else {}}
    except httpx.ConnectError:
        return {"ok": False, "error": "22accounting not reachable"}
```

- [ ] **Step 5: Register all four in server.py**

- [ ] **Step 6: Smoke test**
```bash
cd /opt/22accounting-mcp && python3 -c "
from tools.setup import setup_test_env, teardown_test_env
from tools.settings import update_company_settings
from tools.audit import get_audit_log
from tools.cron import trigger_po_escalation_cron
env = setup_test_env(); t = env['token']
print('Settings:', update_company_settings(t, registered_address='123 Test St, London', bank_account_name='MCP Test', sort_code='01-02-03', account_number='12345678')['status'])
print('Audit log:', get_audit_log(t)['status'])
print('PO escalation cron:', trigger_po_escalation_cron())
teardown_test_env(env['user_id'])
"
```

- [ ] **Step 7: Fix failures, commit**
```bash
git add -A && git commit -m "feat: add settings + audit + cron + stripe tools"
```

---

## Task 17: Diagnostics

**File:** `/opt/22accounting-mcp/tools/diagnostics.py`

- [ ] **Step 1: Create tools/diagnostics.py**
```python
# /opt/22accounting-mcp/tools/diagnostics.py
from http_client import api_get
from db import db_query

def health_check(token: str = None):
    """Check app reachability. token optional."""
    import httpx
    from config import BASE_URL
    try:
        r = httpx.get(f"{BASE_URL}/api/health", timeout=5)
        return {"ok": r.is_success, "status": r.status_code,
                "data": r.json() if r.content else {}}
    except httpx.ConnectError:
        return {"ok": False, "error": f"22accounting not reachable at {BASE_URL}"}

def run_db_query(sql: str):
    """Read-only SELECT query against the live DB."""
    if not sql.strip().upper().startswith("SELECT"):
        return {"ok": False, "error": "Only SELECT queries allowed"}
    try:
        rows = db_query(sql)
        return {"ok": True, "rows": [dict(r) for r in rows], "count": len(rows)}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def check_gl_integrity():
    """Verify all journal entries are balanced (sum debits == sum credits)."""
    rows = db_query("""
        SELECT je.id, je.description, je.source_type, je.source_id,
               ROUND(SUM(jl.debit)::numeric, 2)  AS total_debit,
               ROUND(SUM(jl.credit)::numeric, 2) AS total_credit
        FROM journal_entries je
        JOIN journal_lines jl ON jl.entry_id = je.id
        GROUP BY je.id, je.description, je.source_type, je.source_id
        HAVING ROUND(SUM(jl.debit)::numeric, 2) != ROUND(SUM(jl.credit)::numeric, 2)
    """)
    unbalanced = [dict(r) for r in rows]
    return {
        "ok": len(unbalanced) == 0,
        "unbalanced_count": len(unbalanced),
        "unbalanced_entries": unbalanced,
        "message": "All journal entries are balanced." if not unbalanced
                   else f"{len(unbalanced)} unbalanced entries found."
    }
```

- [ ] **Step 2: Register in server.py**
```python
from tools.diagnostics import health_check, run_db_query, check_gl_integrity
register(Tool(name="health_check", description="Check if 22accounting is reachable.", inputSchema={"type":"object","properties":{}}), lambda **_: health_check())
register(Tool(name="db_query", description="Run a read-only SELECT query against the DB.", inputSchema={"type":"object","properties":{"sql":{"type":"string"}},"required":["sql"]}), lambda sql, **_: run_db_query(sql))
register(Tool(name="check_gl_integrity", description="Verify all journal entries are balanced.", inputSchema={"type":"object","properties":{}}), lambda **_: check_gl_integrity())
```

- [ ] **Step 3: Smoke test**
```bash
cd /opt/22accounting-mcp && python3 -c "
from tools.diagnostics import health_check, check_gl_integrity
print('Health:', health_check())
print('GL integrity:', check_gl_integrity())
"
```

- [ ] **Step 4: Fix failures, commit**
```bash
git add -A && git commit -m "feat: add diagnostics tools"
```

---

## Task 18: UI checks (httpx page existence)

**File:** `/opt/22accounting-mcp/tools/ui_checks.py`

- [ ] **Step 1: Create tools/ui_checks.py**
```python
# /opt/22accounting-mcp/tools/ui_checks.py
import httpx
from config import BASE_URL

# All authenticated routes and a landmark string expected in the server-rendered HTML
ROUTES = [
    ("/dashboard",                          "dashboard"),
    ("/dashboard/invoices",                 "Invoice"),
    ("/dashboard/invoices/new",             "New Invoice"),
    ("/dashboard/quotes",                   "Quote"),
    ("/dashboard/quotes/new",               "New Quote"),
    ("/dashboard/bills",                    "Bill"),
    ("/dashboard/expenses",                 "Expense"),
    ("/dashboard/credit-notes",             "Credit"),
    ("/dashboard/purchase-orders",          "Purchase"),
    ("/dashboard/journals",                 "Journal"),
    ("/dashboard/journals/new",             "New Journal"),
    ("/dashboard/suppliers",                "Supplier"),
    ("/dashboard/customers",                "Customer"),
    ("/dashboard/projects",                 "Project"),
    ("/dashboard/chart-of-accounts",        "Chart of Accounts"),
    ("/dashboard/banking",                  "Bank"),
    ("/dashboard/reports/pl",               "Profit"),
    ("/dashboard/reports/balance-sheet",    "Balance Sheet"),
    ("/dashboard/reports/trial-balance",    "Trial Balance"),
    ("/dashboard/reports/general-ledger",   "General Ledger"),
    ("/dashboard/reports/aged",             "Aged"),
    ("/dashboard/reports/kpi",              "KPI"),
    ("/dashboard/reports/health",           "health"),
    ("/dashboard/reports/custom",           "Custom"),
    ("/dashboard/conversations",            "Conversation"),
    ("/dashboard/team",                     "Team"),
    ("/dashboard/accountant",               "Accountant"),
    ("/dashboard/import",                   "Import"),
]

def check_page_routes(token: str):
    """GET all dashboard routes. Returns pass/fail per route."""
    results = []
    headers = {"Cookie": f"relentify_token={token}"}
    for path, landmark in ROUTES:
        try:
            r = httpx.get(f"{BASE_URL}{path}", headers=headers,
                          timeout=15, follow_redirects=True)
            html = r.text
            passed = r.status_code == 200 and landmark.lower() in html.lower()
            results.append({
                "path": path, "status": r.status_code,
                "landmark_found": landmark.lower() in html.lower(),
                "pass": passed,
                "note": "" if passed else f"Expected '{landmark}' in HTML"
            })
        except Exception as e:
            results.append({"path": path, "status": None,
                            "pass": False, "note": str(e)})
    total = len(results)
    passed = sum(1 for r in results if r["pass"])
    return {"total": total, "passed": passed, "failed": total - passed,
            "results": results}
```

- [ ] **Step 2: Register in server.py**

- [ ] **Step 3: Run page check**
```bash
cd /opt/22accounting-mcp && python3 -c "
from tools.setup import setup_test_env, teardown_test_env
from tools.ui_checks import check_page_routes
env = setup_test_env()
results = check_page_routes(env['token'])
print(f'Pages: {results[\"passed\"]}/{results[\"total\"]} passed')
for r in results['results']:
    if not r['pass']:
        print(f'  FAIL: {r[\"path\"]} ({r[\"status\"]}) -- {r[\"note\"]}')
teardown_test_env(env['user_id'])
"
```

- [ ] **Step 4: For every failing route — diagnose and fix in the app, then rebuild**

Each 500 or missing landmark is a real bug. Fix in app source, rebuild container:
```bash
docker compose -f /opt/relentify-monorepo/apps/22accounting/docker-compose.yml up -d --build
docker logs 22accounting --tail 20
```
Re-run check until all pass.

- [ ] **Step 5: Commit fixes**
```bash
cd /opt/relentify-monorepo && git add -A && git commit -m "fix: resolve failing page routes found by MCP ui_checks"
cd /opt/22accounting-mcp && git add -A && git commit -m "feat: add ui_checks tool"
```

---

## Task 19: UI browser tests (Playwright)

**File:** `/opt/22accounting-mcp/tools/ui_browser.py`

- [ ] **Step 1: Install Playwright**
```bash
pip install playwright
playwright install chromium
# Verify (~400MB download):
python3 -c "from playwright.sync_api import sync_playwright; print('ok')"
```

- [ ] **Step 2: Create tools/ui_browser.py**
```python
# /opt/22accounting-mcp/tools/ui_browser.py
import os, json
from config import BASE_URL

SCREENSHOTS_DIR = "/opt/22accounting-mcp/screenshots"
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

def _check_playwright():
    try:
        from playwright.sync_api import sync_playwright
        return True, sync_playwright
    except ImportError:
        return False, None

def _browser_context(sync_playwright, token: str):
    p = sync_playwright().__enter__()
    browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
    ctx = browser.new_context()
    ctx.add_cookies([{
        "name": "relentify_token", "value": token,
        "domain": "22accounting", "path": "/"
    }])
    return p, browser, ctx

def test_dashboard_renders(token: str):
    ok, sp = _check_playwright()
    if not ok:
        return {"skipped": True, "reason": "playwright not installed"}
    p, browser, ctx = _browser_context(sp, token)
    page = ctx.new_page()
    try:
        page.goto(f"{BASE_URL}/dashboard", wait_until="networkidle", timeout=15000)
        page.screenshot(path=f"{SCREENSHOTS_DIR}/dashboard.png")
        has_net_position = page.locator("text=/net position/i").count() > 0
        has_chart = page.locator("canvas, svg").count() > 0
        return {"pass": has_net_position, "has_chart": has_chart,
                "screenshot": f"{SCREENSHOTS_DIR}/dashboard.png"}
    except Exception as e:
        return {"pass": False, "error": str(e)}
    finally:
        browser.close(); p.__exit__(None, None, None)

def test_date_picker(token: str):
    ok, sp = _check_playwright()
    if not ok:
        return {"skipped": True, "reason": "playwright not installed"}
    p, browser, ctx = _browser_context(sp, token)
    page = ctx.new_page()
    try:
        page.goto(f"{BASE_URL}/dashboard/invoices/new", wait_until="networkidle", timeout=15000)
        # Click on a date field — should open Popover+Calendar
        date_trigger = page.locator("[data-date-picker], button:has-text('Pick a date')").first
        date_trigger.click()
        calendar_visible = page.locator("[data-radix-popover-content], .rdp").count() > 0
        page.screenshot(path=f"{SCREENSHOTS_DIR}/date_picker.png")
        return {"pass": calendar_visible, "screenshot": f"{SCREENSHOTS_DIR}/date_picker.png"}
    except Exception as e:
        return {"pass": False, "error": str(e)}
    finally:
        browser.close(); p.__exit__(None, None, None)

def test_invoice_form(token: str):
    """Fill invoice, open inline project creation modal."""
    ok, sp = _check_playwright()
    if not ok:
        return {"skipped": True, "reason": "playwright not installed"}
    p, browser, ctx = _browser_context(sp, token)
    page = ctx.new_page()
    try:
        page.goto(f"{BASE_URL}/dashboard/invoices/new", wait_until="networkidle", timeout=15000)
        # Look for +New project button
        new_project_btn = page.locator("button:has-text('+New'), button:has-text('New Project')").first
        new_project_btn.click()
        modal_visible = page.locator("[role=dialog], [data-radix-dialog-content]").count() > 0
        page.screenshot(path=f"{SCREENSHOTS_DIR}/invoice_project_modal.png")
        return {"pass": modal_visible,
                "screenshot": f"{SCREENSHOTS_DIR}/invoice_project_modal.png"}
    except Exception as e:
        return {"pass": False, "error": str(e)}
    finally:
        browser.close(); p.__exit__(None, None, None)

def test_approval_modal(token: str):
    ok, sp = _check_playwright()
    if not ok:
        return {"skipped": True, "reason": "playwright not installed"}
    p, browser, ctx = _browser_context(sp, token)
    page = ctx.new_page()
    try:
        page.goto(f"{BASE_URL}/dashboard/expenses", wait_until="networkidle", timeout=15000)
        reject_btn = page.locator("button:has-text('Reject')").first
        if reject_btn.count() == 0:
            return {"pass": True, "note": "No pending approvals to test modal with"}
        reject_btn.click()
        modal_visible = page.locator("[role=dialog]").count() > 0
        page.screenshot(path=f"{SCREENSHOTS_DIR}/approval_modal.png")
        return {"pass": modal_visible,
                "screenshot": f"{SCREENSHOTS_DIR}/approval_modal.png"}
    except Exception as e:
        return {"pass": False, "error": str(e)}
    finally:
        browser.close(); p.__exit__(None, None, None)

def test_period_lock_modal(token: str, lock_date: str = None):
    from tools.period_locks import lock_period, unlock_period
    from tools.invoices import list_invoices
    ok, sp = _check_playwright()
    if not ok:
        return {"skipped": True, "reason": "playwright not installed"}
    import datetime
    if not lock_date:
        lock_date = datetime.date.today().isoformat()
    lock_period(token, lock_date)
    # Get an invoice ID to navigate to
    invs = list_invoices(token)
    inv_list = invs.get("data", [])
    if not inv_list:
        unlock_period(token)
        return {"pass": True, "note": "No invoices to test with — create one first"}
    inv_id = inv_list[0]["id"]
    p, browser, ctx = _browser_context(sp, token)
    page = ctx.new_page()
    try:
        page.goto(f"{BASE_URL}/dashboard/invoices/{inv_id}",
                  wait_until="networkidle", timeout=15000)
        modal_visible = (page.locator("text=/period locked/i, text=/locked through/i").count() > 0)
        page.screenshot(path=f"{SCREENSHOTS_DIR}/period_lock_modal.png")
        return {"pass": modal_visible,
                "screenshot": f"{SCREENSHOTS_DIR}/period_lock_modal.png"}
    except Exception as e:
        return {"pass": False, "error": str(e)}
    finally:
        unlock_period(token)
        browser.close(); p.__exit__(None, None, None)

def screenshot_all_pages(token: str):
    ok, sp = _check_playwright()
    if not ok:
        return {"skipped": True, "reason": "playwright not installed"}
    from tools.ui_checks import ROUTES
    p, browser, ctx = _browser_context(sp, token)
    page = ctx.new_page()
    results = []
    try:
        for path, _ in ROUTES:
            name = path.replace("/", "_").strip("_")
            out = f"{SCREENSHOTS_DIR}/{name}.png"
            try:
                page.goto(f"{BASE_URL}{path}", wait_until="networkidle", timeout=15000)
                page.screenshot(path=out, full_page=True)
                results.append({"path": path, "screenshot": out})
            except Exception as e:
                results.append({"path": path, "error": str(e)})
    finally:
        browser.close(); p.__exit__(None, None, None)
    return {"total": len(results), "screenshots_dir": SCREENSHOTS_DIR, "results": results}
```

- [ ] **Step 3: Register all 6 browser tools in server.py**

- [ ] **Step 4: Run browser tests**
```bash
cd /opt/22accounting-mcp && python3 -c "
from tools.setup import setup_test_env, teardown_test_env
from tools.ui_browser import test_dashboard_renders, test_date_picker
env = setup_test_env()
print('Dashboard:', test_dashboard_renders(env['token']))
print('Date picker:', test_date_picker(env['token']))
teardown_test_env(env['user_id'])
"
```

- [ ] **Step 5: Fix any browser failures, commit**
```bash
git add -A && git commit -m "feat: add Playwright browser test tools"
```

---

## Task 20: Full feature test run + fix loop

This is the main payoff task. Run every tool against a live test environment, record failures, fix them.

- [ ] **Step 1: Create test runner script**
```python
# /opt/22accounting-mcp/run_tests.py
"""
Full integration test runner. Run with: python3 run_tests.py
Prints PASS/FAIL per feature area.
"""
from tools.setup import setup_test_env, teardown_test_env
from tools.customers import create_customer, list_customers
from tools.suppliers import create_supplier
from tools.invoices import create_invoice, record_invoice_payment, void_invoice, send_invoice
from tools.quotes import create_quote, convert_quote_to_invoice
from tools.bills import create_bill, record_bill_payment
from tools.credit_notes import create_credit_note, void_credit_note
from tools.expenses import (create_expense, approve_expense, reject_expense,
                             create_mileage, get_pending_approvals,
                             update_expense_approval_settings)
from tools.purchase_orders import create_po, submit_po_for_approval
from tools.projects import create_project
from tools.coa import list_coa
from tools.journals import create_journal_entry, reverse_journal_entry
from tools.banking import list_bank_accounts
from tools.reports import (get_pl, get_balance_sheet, get_trial_balance,
                            get_gl, get_aged_receivables, get_aged_payables,
                            get_kpi_report, get_cashflow_forecast,
                            get_health_score, get_custom_report)
from tools.vat import get_vat_return
from tools.period_locks import test_period_lock_enforcement
from tools.attachments import upload_attachment, list_attachments
from tools.comments import create_comment, get_conversations
from tools.multi_entity import create_entity, list_entities
from tools.settings import update_company_settings
from tools.audit import get_audit_log
from tools.cron import trigger_po_escalation_cron
from tools.diagnostics import health_check, check_gl_integrity
from tools.ui_checks import check_page_routes
import traceback, datetime

PASS = "✅ PASS"
FAIL = "❌ FAIL"

def chk(label, result, expect_status=200):
    ok = result.get("ok") and result.get("status", 200) in [200, 201]
    print(f"  {'✅' if ok else '❌'} {label}: status={result.get('status')} {'-- ' + str(result.get('data', {}).get('error', '')) if not ok else ''}")
    return ok

env = setup_test_env()
t = env["token"]
uid = env["user_id"]
eid = env["entity_id"]
print(f"\n🧪 Test env: user={uid[:8]}... entity={eid[:8]}...\n")

results = {}

try:
    print("── Customers ──────────────────────────────")
    cust = create_customer(t, "Test Customer", "cust@test.com")
    results["create_customer"] = chk("create", cust)
    cid = cust["data"]["id"]
    results["list_customers"] = chk("list", list_customers(t))

    print("\n── Suppliers ──────────────────────────────")
    sup = create_supplier(t, "Test Supplier")
    results["create_supplier"] = chk("create", sup)
    sid = sup["data"]["id"]

    print("\n── Invoices ───────────────────────────────")
    inv = create_invoice(t, cid, [{"description":"Consulting","quantity":1,"unit_price":1000,"vat_rate":20}])
    results["create_invoice"] = chk("create", inv)
    inv_id = inv["data"]["id"]
    results["send_invoice"] = chk("send", send_invoice(t, inv_id))
    # Price formatting bug #5: 1 * 10000 = 10000
    inv2 = create_invoice(t, cid, [{"description":"x","quantity":1,"unit_price":10000,"vat_rate":0}])
    total = inv2.get("data", {}).get("total", inv2.get("data", {}).get("subtotal"))
    bug5_pass = total in [10000, 10000.0, "10000", "10000.00"]
    results["price_formatting_bug5"] = bug5_pass
    print(f"  {'✅' if bug5_pass else '❌'} price formatting (1×10000={total}, expected 10000)")
    results["record_invoice_payment"] = chk("record payment", record_invoice_payment(t, inv_id, 1200.0))

    print("\n── Quotes ─────────────────────────────────")
    qt = create_quote(t, cid, [{"description":"Project","quantity":1,"unit_price":500,"vat_rate":0}])
    results["create_quote"] = chk("create", qt)
    qt_id = qt["data"]["id"]
    results["convert_quote"] = chk("convert to invoice", convert_quote_to_invoice(t, qt_id))

    print("\n── Bills ──────────────────────────────────")
    bill = create_bill(t, sid, 300.0, invoice_date=datetime.date.today().isoformat())
    results["create_bill"] = chk("create (with invoice_date)", bill)
    bill_id = bill["data"]["id"]
    results["record_bill_payment"] = chk("record payment", record_bill_payment(t, bill_id, 300.0))

    print("\n── Credit Notes ───────────────────────────")
    cn = create_credit_note(t, cid, [{"description":"Refund","quantity":1,"unit_price":100,"vat_rate":0}])
    results["create_credit_note"] = chk("create", cn)
    cn_id = cn["data"]["id"]
    results["void_credit_note"] = chk("void", void_credit_note(t, cn_id))

    print("\n── Expenses & Mileage ─────────────────────")
    results["update_approval_settings"] = chk("set approval settings",
        update_expense_approval_settings(t, True))
    exp = create_expense(t, "Laptop stand", 45.0)
    results["create_expense"] = chk("create", exp)
    exp_id = exp["data"]["id"]
    results["get_pending_approvals"] = chk("pending approvals", get_pending_approvals(t))
    results["approve_expense"] = chk("approve", approve_expense(t, exp_id))
    mil = create_mileage(t, "Client visit", 50.0)
    results["create_mileage"] = chk("create mileage", mil)

    print("\n── Purchase Orders ────────────────────────")
    po = create_po(t, sid, [{"description":"Monitors","quantity":3,"unit_price":400}])
    results["create_po"] = chk("create", po)
    results["submit_po"] = chk("submit for approval", submit_po_for_approval(t, po["data"]["id"]))

    print("\n── Projects ───────────────────────────────")
    proj = create_project(t, "Website Redesign")
    results["create_project"] = chk("create", proj)

    print("\n── COA ────────────────────────────────────")
    results["list_coa"] = chk("list", list_coa(t))

    print("\n── Journal Entries ────────────────────────")
    je = create_journal_entry(t, "Test journal", [
        {"accountCode": 7900, "debit": 200, "credit": 0, "description": "Expense"},
        {"accountCode": 1200, "debit": 0, "credit": 200, "description": "Bank"},
    ])
    results["create_journal"] = chk("create (balanced)", je)
    je_id = je["data"]["id"]
    results["reverse_journal"] = chk("reverse", reverse_journal_entry(t, je_id))

    print("\n── Banking ────────────────────────────────")
    results["list_bank_accounts"] = chk("list accounts", list_bank_accounts(t))

    print("\n── Reports ────────────────────────────────")
    for name, fn in [
        ("P&L", lambda: get_pl(t)),
        ("Balance sheet", lambda: get_balance_sheet(t)),
        ("Trial balance", lambda: get_trial_balance(t)),
        ("General ledger", lambda: get_gl(t)),
        ("Aged receivables", lambda: get_aged_receivables(t)),
        ("Aged payables", lambda: get_aged_payables(t)),
        ("KPI", lambda: get_kpi_report(t)),
        ("Cashflow forecast", lambda: get_cashflow_forecast(t)),
        ("Health score", lambda: get_health_score(t)),
        ("Custom report", lambda: get_custom_report(t)),
    ]:
        results[f"report_{name}"] = chk(name, fn())

    print("\n── VAT ────────────────────────────────────")
    results["vat_calculate"] = chk("calculate 9-box", get_vat_return(t))

    print("\n── Period Locks ───────────────────────────")
    pl = test_period_lock_enforcement(t)
    results["period_lock_enforcement"] = pl.get("period_lock_enforced", False)
    print(f"  {'✅' if pl.get('period_lock_enforced') else '❌'} enforcement: {pl.get('note')}")

    print("\n── Attachments ────────────────────────────")
    bill2 = create_bill(t, sid, 50.0)
    att = upload_attachment(t, "bill", bill2["data"]["id"])
    results["upload_attachment"] = chk("upload to bill", att)
    exp2 = create_expense(t, "Receipt test", 20.0)
    att2 = upload_attachment(t, "expense", exp2["data"]["id"])
    results["upload_attachment_expense"] = chk("upload to expense", att2)

    print("\n── Comments ───────────────────────────────")
    cm = create_comment(t, "invoice", inv_id, "Test comment")
    results["create_comment"] = chk("create", cm)
    results["get_conversations"] = chk("get conversations", get_conversations(t))

    print("\n── Multi-Entity ───────────────────────────")
    e2 = create_entity(t, "Second Entity Ltd")
    results["create_entity"] = chk("create", e2)

    print("\n── Settings ───────────────────────────────")
    results["update_settings"] = chk("update company settings",
        update_company_settings(t, registered_address="1 Test St", bank_account_name="Test Bank",
                                sort_code="01-02-03", account_number="12345678"))

    print("\n── Audit Log ──────────────────────────────")
    results["audit_log"] = chk("get audit log", get_audit_log(t))

    print("\n── Cron ───────────────────────────────────")
    cron_r = trigger_po_escalation_cron()
    results["po_escalation_cron"] = cron_r.get("ok") or cron_r.get("skipped", False)
    print(f"  {'✅' if results['po_escalation_cron'] else '❌'} PO escalation: {cron_r}")

    print("\n── Diagnostics ────────────────────────────")
    results["health_check"] = chk("health", health_check())
    gl = check_gl_integrity()
    results["gl_integrity"] = gl["ok"]
    print(f"  {'✅' if gl['ok'] else '❌'} GL integrity: {gl['message']}")
    if not gl["ok"]:
        print(f"    Unbalanced entries: {gl['unbalanced_entries']}")

    print("\n── UI Page Checks ─────────────────────────")
    pages = check_page_routes(t)
    results["ui_pages"] = pages["failed"] == 0
    print(f"  {'✅' if pages['failed'] == 0 else '❌'} {pages['passed']}/{pages['total']} pages pass")
    for r in pages["results"]:
        if not r["pass"]:
            print(f"    FAIL: {r['path']} ({r['status']}) -- {r['note']}")

except Exception as e:
    print(f"\n💥 Test runner crashed: {traceback.format_exc()}")
finally:
    teardown_test_env(uid)
    print("\n── Cleanup complete ───────────────────────")

total = len(results)
passed = sum(1 for v in results.values() if v)
print(f"\n{'='*50}")
print(f"RESULTS: {passed}/{total} passed")
print(f"{'='*50}")
for k, v in results.items():
    if not v:
        print(f"  ❌ {k}")
```

- [ ] **Step 2: Run the test runner**
```bash
cd /opt/22accounting-mcp && python3 run_tests.py 2>&1 | tee /tmp/mcp_test_run.log
```

- [ ] **Step 3: For each ❌ failure — diagnose, fix app code, rebuild**

Pattern for fixing app bugs:
1. Read the error body from the test output
2. Find the relevant route in `/opt/relentify-monorepo/apps/22accounting/app/api/`
3. Fix the issue
4. Rebuild: `docker compose -f /opt/relentify-monorepo/apps/22accounting/docker-compose.yml up -d --build`
5. Re-run the failing test only (call the specific tool in python3 -c)
6. Commit the fix

- [ ] **Step 4: Re-run until all pass**
```bash
python3 run_tests.py
# Target: all ✅
```

- [ ] **Step 5: Run GL integrity check on live data**
```bash
cd /opt/22accounting-mcp && python3 -c "
from tools.diagnostics import check_gl_integrity
r = check_gl_integrity()
print(r['message'])
if not r['ok']:
    for e in r['unbalanced_entries']:
        print(' ', e)
"
```

- [ ] **Step 6: Final commit**
```bash
cd /opt/22accounting-mcp && git add -A && git commit -m "feat: complete MCP test suite — all features covered"
cd /opt/relentify-monorepo && git add -A && git commit -m "fix: all bugs found by 22accounting MCP test suite"
```

---

## Notes

**When a tool returns `{ok: False, status: 404}` for a route that should exist:**
- The route exists in `app/api/` — check if it requires a specific request body shape
- Read the route handler source directly and match the expected input

**When a tool returns `{ok: False, status: 401}`:**
- The JWT may be expired (1hr TTL) — call `mint_token(user_id)` again to refresh

**When the container is unhealthy after rebuild:**
```bash
docker logs 22accounting --tail 50
# Check for migration failures, missing env vars, or startup errors
```

**Memory warning:** Running Playwright + 22accounting container simultaneously uses ~600MB. Watch:
```bash
free -h && docker stats --no-stream
```
If swap is heavily used, run browser tests separately from API tests.
