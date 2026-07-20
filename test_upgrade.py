import sqlite3

def upgrade_schema():
    print("Upgrading database schema...")
    try:
        conn = sqlite3.connect('auraimmo.db')
        cursor = conn.cursor()
        
        # Check and add new columns to properties
        cursor.execute("PRAGMA table_info(properties)")
        columns = [col[1] for col in cursor.fetchall()]
        
        new_columns = [
            ("transaction_type", "VARCHAR DEFAULT 'Location'"),
            ("price", "FLOAT"),
            ("caution_amount", "FLOAT"),
            ("commission_rate", "FLOAT"),
            ("tenant_name", "VARCHAR"),
            ("tenant_phone", "VARCHAR")
        ]
        
        for col_name, col_type in new_columns:
            if col_name not in columns:
                print(f"Adding column {col_name} to properties table...")
                cursor.execute(f"ALTER TABLE properties ADD COLUMN {col_name} {col_type}")
                
        conn.commit()
    except Exception as e:
        print(f"Error upgrading schema: {e}")
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == '__main__':
    upgrade_schema()
