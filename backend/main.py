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
                
        # Update PostgreSQL foreign key constraints to use ON DELETE CASCADE so SQL deletions never fail
        cascade_queries = [
            "ALTER TABLE activity_logs DROP CONSTRAINT IF EXISTS activity_logs_user_id_fkey",
            "ALTER TABLE activity_logs ADD CONSTRAINT activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE",
            "ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_user_id_fkey",
            "ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE",
            "ALTER TABLE users DROP CONSTRAINT IF EXISTS users_agency_id_fkey",
            "ALTER TABLE users ADD CONSTRAINT users_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE",
            "ALTER TABLE owners DROP CONSTRAINT IF EXISTS owners_agency_id_fkey",
            "ALTER TABLE owners ADD CONSTRAINT owners_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE",
            "ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_agency_id_fkey",
            "ALTER TABLE properties ADD CONSTRAINT properties_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE",
            "ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_agency_id_fkey",
            "ALTER TABLE tenants ADD CONSTRAINT tenants_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE",
            "ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_agency_id_fkey",
            "ALTER TABLE transactions ADD CONSTRAINT transactions_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE",
            "ALTER TABLE agency_settings DROP CONSTRAINT IF EXISTS agency_settings_agency_id_fkey",
            "ALTER TABLE agency_settings ADD CONSTRAINT agency_settings_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE",
            "ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_agency_id_fkey",
            "ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE",
            "ALTER TABLE activity_logs DROP CONSTRAINT IF EXISTS activity_logs_agency_id_fkey",
            "ALTER TABLE activity_logs ADD CONSTRAINT activity_logs_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE",
            "ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_agency_id_fkey",
            "ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE"
        ]
        for q in cascade_queries:
            try:
                db.execute(text(q))
                db.commit()
            except Exception:
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

        try:
            admin_email = os.getenv("ADMIN_EMAIL", "admin@immovii.com")
            admin_password = os.getenv("ADMIN_PASSWORD", "admin123")
            admin_user = db.query(models.User).filter(
                (models.User.id == "admin-001")
                | (models.User.email == admin_email)
                | (models.User.email == "admin@immovi.com")
                | (models.User.email == "admin@immovii.com")
            ).first()
            if not admin_user:
                hashed_pwd = security.get_password_hash(admin_password)
                admin_user = models.User(
                    id="admin-001",
                    name="Administrateur",
                    email=admin_email,
                    password_hash=hashed_pwd,
                    role="Super Administrateur",
                    status="Actif",
                    permissions=["all"],
                    date_added="2026-07-16"
                )
                db.add(admin_user)
                db.commit()
            else:
                admin_user.email = admin_email
                admin_user.role = "Super Administrateur"
                admin_user.status = "Actif"
                admin_user.password_hash = security.get_password_hash(admin_password)
                db.commit()
        except Exception as e:
            db.rollback()

        # Log system startup activity
        try:
            log_count = db.query(models.ActivityLog).count()
            if log_count == 0:
                models.log_activity(db, "Système", "Démarrage et initialisation du Journal d'Activité Immovii")
                users = db.query(models.User).all()
                for u in users[:5]:
                    models.log_activity(db, "Compte Existant", f"Utilisateur en base : {u.email} ({u.role})", user_id=u.id, agency_id=u.agency_id)
            else:
                models.log_activity(db, "Système", "Démarrage du service Immovii API")
        except Exception:
            pass

    finally:
        db.close()
    yield

app = FastAPI(title="Immovii API", version="1.0.0", lifespan=lifespan)

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
    return {"message": "Bienvenue sur l'API Immovii ! Le backend est en ligne."}

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
