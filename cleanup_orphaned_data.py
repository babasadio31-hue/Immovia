import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Import models
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from backend import models, database

def cleanup_orphaned_data():
    db = database.SessionLocal()
    try:
        # Get all agency IDs currently in the database
        agencies = db.query(models.Agency.id).all()
        agency_ids = [a[0] for a in agencies]
        
        # Get all users to find orphaned agencies (agencies with 0 users)
        # Actually, if an agency has 0 users, it is orphaned and should be deleted!
        # Wait, the user deleted their account but the agency is still in DB.
        # Let's find agencies that have no users associated with them
        agencies_to_delete = []
        all_agencies = db.query(models.Agency).all()
        for agency in all_agencies:
            user_count = db.query(models.User).filter(models.User.agency_id == agency.id).count()
            if user_count == 0:
                agencies_to_delete.append(agency.id)
                
        print(f"Found {len(agencies_to_delete)} orphaned agencies to delete.")
        
        # We will delete data for these orphaned agencies PLUS any data whose agency_id is not in the agencies table at all
        # The latter is just in case some agencies were hard deleted but their data wasn't.
        # We can just construct a list of valid agency IDs (all_agencies minus agencies_to_delete)
        valid_agency_ids = [a.id for a in all_agencies if a.id not in agencies_to_delete]
        
        # Delete from all tables where agency_id is NOT in valid_agency_ids OR agency_id IS NULL (but wait, agency_id shouldn't be null except for superadmin maybe? Superadmin has no agency_id but role Admin. Wait, let's just delete where agency_id IS NOT NULL AND agency_id NOT IN valid_agency_ids)
        
        tables_with_agency = [
            models.ActivityLog,
            models.SupportTicket,
            models.Subscription,
            models.AgencySettings,
            models.Transaction,
            models.Tenant,
            models.Property,
            models.Owner,
            models.User,
            models.Agency
        ]
        
        for table in tables_with_agency:
            # For Agency table, we delete where id not in valid_agency_ids
            if table == models.Agency:
                deleted = db.query(table).filter(table.id.notin_(valid_agency_ids)).delete(synchronize_session=False)
            else:
                # For other tables, delete where agency_id is not in valid_agency_ids and agency_id is not null
                deleted = db.query(table).filter(table.agency_id.isnot(None), table.agency_id.notin_(valid_agency_ids)).delete(synchronize_session=False)
            print(f"Deleted {deleted} records from {table.__tablename__}")
            
        db.commit()
        print("Cleanup completed successfully.")
        
    except Exception as e:
        print(f"Error during cleanup: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    cleanup_orphaned_data()
