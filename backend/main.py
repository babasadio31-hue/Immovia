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

        # Schema upgrade for new columns in properties table
        from sqlalchemy import text
        try:
            db.execute(text("ALTER TABLE properties ADD COLUMN transaction_type VARCHAR DEFAULT 'Location'"))
        except Exception:
            pass
        try:
            db.execute(text("ALTER TABLE properties ADD COLUMN price FLOAT"))
        except Exception:
            pass
        try:
            db.execute(text("ALTER TABLE properties ADD COLUMN caution_amount FLOAT"))
        except Exception:
            pass
        try:
            db.execute(text("ALTER TABLE properties ADD COLUMN commission_rate FLOAT"))
        except Exception:
            pass
        try:
            db.execute(text("ALTER TABLE properties ADD COLUMN tenant_name VARCHAR"))
        except Exception:
            pass
        try:
            db.execute(text("ALTER TABLE properties ADD COLUMN tenant_phone VARCHAR"))
        except Exception:
            pass
        db.commit()

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

from . import owners, properties, tenants, transactions

app.include_router(auth.router)
app.include_router(owners.router)
app.include_router(properties.router)
app.include_router(tenants.router)
app.include_router(transactions.router)

@app.get("/api")
def read_root():
    return {"message": "Bienvenue sur l'API Immovi ! Le backend est en ligne."}

# Servir le frontend pour Railway
import os
frontend_path = os.path.join(os.path.dirname(__file__), "..")
app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")
