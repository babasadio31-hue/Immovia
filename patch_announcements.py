import os
import sys

# Ajouter le répertoire parent au chemin
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.database import engine
from backend.models import Announcement

def apply():
    print("Creating Announcement table...")
    Announcement.__table__.create(bind=engine, checkfirst=True)
    print("Announcement table created successfully.")

if __name__ == "__main__":
    apply()
