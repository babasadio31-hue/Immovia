import sqlite3
import json

conn = sqlite3.connect('auraimmo.db')
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

cursor.execute("SELECT id, name, transaction_type, status, price FROM properties")
rows = cursor.fetchall()
for row in rows:
    print(dict(row))

conn.close()
