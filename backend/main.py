from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
from contextlib import asynccontextmanager

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

@app.get("/")
def read_root():
    return {"message": "Bienvenue sur l'API Immovi ! Le backend est en ligne."}
