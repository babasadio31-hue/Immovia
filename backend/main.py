from pydantic import BaseModel
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv
import os
from contextlib import asynccontextmanager
from sqlalchemy import text

# Load environment variables
load_dotenv()

from . import models, database, auth, owners, properties, tenants, transactions, security

# Create database tables
models.Base.metadata.create_all(bind=database.engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Setup default admin user on startup if no users exist
    db = database.SessionLocal()
    try:

        # Schema upgrade for new columns in properties table
        from sqlalchemy import text
        
        upgrades = [
            "ALTER TABLE properties ADD COLUMN transaction_type VARCHAR DEFAULT 'Location'",
            "ALTER TABLE properties ADD COLUMN price FLOAT",
            "ALTER TABLE properties ADD COLUMN caution_amount FLOAT",
            "ALTER TABLE properties ADD COLUMN commission_rate FLOAT",
            "ALTER TABLE properties ADD COLUMN tenant_name VARCHAR",
                        "ALTER TABLE properties ADD COLUMN tenant_phone VARCHAR",
            "ALTER TABLE properties ADD COLUMN mandate_start VARCHAR",
            "ALTER TABLE properties ADD COLUMN mandate_end VARCHAR",
            "ALTER TABLE owners ADD COLUMN mandate_start VARCHAR",
            "ALTER TABLE owners ADD COLUMN mandate_end VARCHAR",
            "ALTER TABLE tenants ADD COLUMN cni VARCHAR",
            "ALTER TABLE properties ADD COLUMN tenant_cni VARCHAR"
        ]
        
        for upgrade in upgrades:
            try:
                db.execute(text(upgrade))
                db.commit()
            except Exception:
                db.rollback()
                
        try:
            db.execute(text("ALTER TABLE users ADD COLUMN verification_token VARCHAR"))
            db.commit()
        except Exception:
            db.rollback()
                
        # Back-office upgrades
        tables = ["users", "owners", "properties", "tenants", "transactions", "agency_settings", "support_tickets", "activity_logs"]
        for table in tables:
            try:
                db.execute(text(f"ALTER TABLE {table} ADD COLUMN agency_id VARCHAR REFERENCES agencies(id)"))
                db.commit()
            except Exception as e:
                db.rollback()
                
        # Backfill expiration dates for agencies
        try:
            from datetime import datetime, timedelta
            agencies = db.query(models.Agency).filter(models.Agency.subscription_expiry == None).all()
            for agency in agencies:
                if agency.date_added:
                    try:
                        added = datetime.strptime(agency.date_added, "%Y-%m-%d")
                    except:
                        added = datetime.now()
                    agency.subscription_expiry = (added + timedelta(days=3)).strftime("%Y-%m-%d")
            db.commit()
        except Exception:
            db.rollback()

        user_count = db.query(models.User).count()
        if user_count == 0:
            hashed_pwd = security.get_password_hash("admin123")
            admin_user = models.User(
                id="admin-001",
                name="Administrateur",
                email="admin@immovi.com",
                password_hash=hashed_pwd,
                role="Admin",
                status="Actif",
                permissions=["all"],
                date_added="2026-07-16"
            )
            db.add(admin_user)
            db.commit()

        # Log system startup activity
        try:
            log_count = db.query(models.ActivityLog).count()
            if log_count == 0:
                models.log_activity(db, "Système", "Démarrage et initialisation du Journal d'Activité Immovi")
                users = db.query(models.User).all()
                for u in users[:5]:
                    models.log_activity(db, "Compte Existant", f"Utilisateur en base : {u.email} ({u.role})", user_id=u.id, agency_id=u.agency_id)
            else:
                models.log_activity(db, "Système", "Démarrage du service Immovi API")
        except Exception:
            pass

    finally:
        db.close()
    yield

app = FastAPI(title="Immovi API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, replace with the frontend URL
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

from . import owners, properties, tenants, transactions, settings, payments, admin, tickets

app.include_router(auth.router)
app.include_router(owners.router)
app.include_router(properties.router)
app.include_router(tenants.router)
app.include_router(transactions.router)
app.include_router(settings.router)
app.include_router(payments.router)
app.include_router(admin.router)
app.include_router(tickets.router)

@app.get("/api")
def read_root():
    return {"message": "Bienvenue sur l'API Immovi ! Le backend est en ligne."}

from pydantic import BaseModel
import uuid
import datetime
from sqlalchemy.orm import Session
from fastapi import Depends
from . import database, models

class ContactRequest(BaseModel):
    name: str
    email: str
    phone: str
    message: str

@app.post("/api/contact")
def receive_contact_message(contact: ContactRequest, db: Session = Depends(database.get_db)):
    msg = models.ContactMessage(
        id=f"MSG-{uuid.uuid4().hex[:8].upper()}",
        name=contact.name,
        email=contact.email,
        phone=contact.phone,
        message=contact.message,
        status="Non lu",
        date=datetime.datetime.utcnow().isoformat() + "Z"
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return {"message": "Success"}

# Servir le frontend pour Railway
import os
frontend_path = os.path.join(os.path.dirname(__file__), "..")

@app.get("/")
async def serve_landing():
    return FileResponse(os.path.join(frontend_path, "landing.html"))

app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")
