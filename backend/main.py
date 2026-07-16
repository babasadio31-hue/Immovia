from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

from . import models, database, auth

# Create database tables
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="AuraImmo API", version="1.0.0")

# Allow CORS for front-end access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, replace with the frontend URL
    allow_credentials=True,
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
    return {"message": "Bienvenue sur l'API AuraImmo ! Le backend est en ligne."}
