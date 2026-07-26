import uuid
from datetime import date
from backend.database import SessionLocal
from backend.models import User, Agency
from backend.security import get_password_hash

db = SessionLocal()

email = "bbcongo99@gmail.com"
password = "BB23061993"
hashed_password = get_password_hash(password)

# Check if user already exists
user = db.query(User).filter(User.email == email).first()
if user:
    print("User already exists. Updating password...")
    user.password_hash = hashed_password
else:
    print("Creating new user...")
    user = User(
        id=str(uuid.uuid4()),
        name="Sadio", # default name
        email=email,
        phone="",
        password_hash=hashed_password,
        role="Administrateur",
        status="Actif", # Force active since they already had the back office
        permissions=["dashboard", "owners", "properties", "tenants", "finances", "settings"],
        date_added=str(date.today()),
        verification_token=None
    )
    db.add(user)

db.commit()
db.refresh(user)
print("User created/updated successfully with ID:", user.id)

# Now about the agency, since they said they created the back office with this email, maybe they have an agency.
# I'll check if there's an agency and link it.
agency = db.query(Agency).first()
if agency and not user.agency_id:
    user.agency_id = agency.id
    db.commit()
    print("Linked to agency:", agency.name)

db.close()
