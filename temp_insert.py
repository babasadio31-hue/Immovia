import uuid
from datetime import date
from sqlalchemy import create_engine, Column, String, Integer, JSON, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker

db_url = "postgresql+pg8000://postgres:pSTTASUJLcofvKvlGxookEfnFpzeFqWm@tokaido.proxy.rlwy.net:36329/railway"

engine = create_engine(db_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Agency(Base):
    __tablename__ = "agencies"
    id = Column(String, primary_key=True, index=True)
    name = Column(String, index=True)

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, index=True)
    agency_id = Column(String, ForeignKey("agencies.id"), nullable=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    phone = Column(String)
    password_hash = Column(String)
    role = Column(String)
    status = Column(String, default="Actif")
    permissions = Column(JSON)
    date_added = Column(String)
    verification_token = Column(String, nullable=True)

from backend.security import get_password_hash

db = SessionLocal()

email = "bbcongo99@gmail.com"
password = "BB23061993"
hashed_password = get_password_hash(password)

user = db.query(User).filter(User.email == email).first()
if user:
    print("User already exists. Updating password...")
    user.password_hash = hashed_password
else:
    print("Creating new user...")
    user = User(
        id=str(uuid.uuid4()),
        name="Admin",
        email=email,
        phone="",
        password_hash=hashed_password,
        role="Administrateur",
        status="Actif",
        permissions=["dashboard", "owners", "properties", "tenants", "finances", "settings"],
        date_added=str(date.today()),
        verification_token=None
    )
    db.add(user)

db.commit()
db.refresh(user)
print("User ID:", user.id)

agency = db.query(Agency).first()
if agency and not user.agency_id:
    user.agency_id = agency.id
    db.commit()
    print("Linked to agency:", agency.name)

db.close()
