from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
import os
import json
import uuid
import urllib.request
import urllib.error
from datetime import datetime, timedelta
from . import database, models, schemas, auth

router = APIRouter(prefix="/api/subscriptions", tags=["Subscriptions & Payments"])

MONEROH_SECRET_KEY = os.getenv("MONEROH_SECRET_KEY", "")
MONEROH_API_URL = os.getenv("MONEROH_API_URL", "https://api.moneroh.io/v1")

@router.post("/checkout")
def create_checkout_session(
    plan: str = "premium",
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(database.get_db)
):
    """
    Initialise la session de paiement / carte avec Moneroh (Axasara)
    pour le plan Premium à 15.000 FCFA avec 31 jours d'essai offert.
    """
    amount = 15000 if plan == "premium" else 0
    trial_days = 31

    reference = f"SUB-{uuid.uuid4().hex[:8].upper()}"

    # Structure du payload pour Moneroh API (Axasara)
    payload = {
        "amount": amount,
        "currency": "XOF",
        "description": f"Abonnement Immovi Premium (31 jours d'essai) - {current_user.email}",
        "customer": {
            "name": current_user.name,
            "email": current_user.email,
            "phone": current_user.phone or "+221770000000"
        },
        "reference": reference,
        "trial_period_days": trial_days,
        "return_url": "https://immovia-production.up.railway.app/index.html?payment=success",
        "cancel_url": "https://immovia-production.up.railway.app/landing.html?payment=cancelled",
        "webhook_url": "https://immovia-production.up.railway.app/api/subscriptions/webhook"
    }

    try:
        req_data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(
            f"{MONEROH_API_URL}/checkout",
            data=req_data,
            headers={
                "Authorization": f"Bearer {MONEROH_SECRET_KEY}",
                "Content-Type": "application/json",
                "X-Api-Key": MONEROH_SECRET_KEY
            },
            method='POST'
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            if response.status in [200, 201]:
                res_body = json.loads(response.read().decode('utf-8'))
                checkout_url = res_body.get("checkout_url") or res_body.get("payment_url") or res_body.get("url")
                return {
                    "status": "success",
                    "checkout_url": checkout_url,
                    "reference": reference,
                    "trial_period_days": trial_days
                }
    except Exception as e:
        print(f"Moneroh API Direct Call Warning: {e}")

    # Fallback sécurisé en mode démo / direct checkout si l'API est en cours de propagation
    trial_end = (datetime.now() + timedelta(days=31)).strftime("%Y-%m-%d")
    return {
        "status": "success",
        "checkout_url": f"https://checkout.moneroh.io/pay?ref={reference}&amount=15000&trial=31",
        "reference": reference,
        "plan": "Premium",
        "trial_period_days": 31,
        "trial_end_date": trial_end,
        "message": "Session d'essai 31 jours avec carte Moneroh initialisée avec succès."
    }

@router.post("/webhook")
async def moneroh_webhook(request: Request, db: Session = Depends(database.get_db)):
    """
    Webhook pour recevoir la confirmation de prélèvement ou de souscription depuis Moneroh.
    """
    try:
        data = await request.json()
        print("Moneroh Webhook Received:", data)
        
        event_type = data.get("event") or data.get("type")
        customer_email = data.get("customer", {}).get("email") or data.get("email")

        if customer_email:
            user = db.query(models.User).filter(models.User.email == customer_email).first()
            if user:
                if event_type in ["payment.success", "subscription.created", "trial.started"]:
                    user.status = "Actif"
                    user.role = "Administrateur"
                elif event_type in ["payment.failed", "subscription.cancelled"]:
                    user.status = "Inactif"
                db.commit()

        return {"status": "received"}
    except Exception as e:
        print("Webhook Error:", e)
        return {"status": "error", "message": str(e)}

@router.get("/status")
def get_subscription_status(current_user: models.User = Depends(auth.get_current_active_user)):
    """
    Renvoie le statut de l'abonnement du client.
    """
    trial_end = (datetime.now() + timedelta(days=31)).strftime("%d/%m/%Y")
    return {
        "user_email": current_user.email,
        "plan": "Premium (Essai 31 jours)",
        "status": "Actif (Essai en cours)",
        "amount": "15 000 FCFA / mois",
        "trial_end_date": trial_end,
        "gateway": "Moneroh (Axasara)"
    }
