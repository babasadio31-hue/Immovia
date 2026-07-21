import sqlite3

conn = sqlite3.connect('auraimmo.db')
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

cursor.execute("SELECT id, property_id, type, amount, description FROM transactions")
rows = cursor.fetchall()
for row in rows:
    print(dict(row))

conn.close()
