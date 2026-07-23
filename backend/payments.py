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

MONEROO_SECRET_KEY = os.getenv("MONEROO_SECRET_KEY", "")
MONEROO_API_URL = os.getenv("MONEROO_API_URL", "https://api.moneroo.io/v1")

@router.post("/checkout")
def create_checkout_session(
    plan: str = "premium",
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(database.get_db)
):
    """
    Initialise la session de paiement / carte avec Moneroo (Axasara)
    pour le plan Premium à 1.000 FCFA sans essai.
    """
    amount = 1000 if plan == "premium" else 0
    trial_days = 0

    reference = f"SUB-{uuid.uuid4().hex[:8].upper()}"

    name_parts = current_user.name.split(" ", 1)
    first_name = name_parts[0]
    last_name = name_parts[1] if len(name_parts) > 1 else name_parts[0]

    payload = {
        "amount": amount,
        "currency": "XOF",
        "description": f"Abonnement Immovi Premium (Paiement immédiat) - {current_user.email}",
        "customer": {
            "email": current_user.email,
            "first_name": first_name,
            "last_name": last_name,
            "phone": current_user.phone or "+221770000000"
        },
        "reference": reference,
        "return_url": "https://immovia-production.up.railway.app/index.html?payment=success",
        "cancel_url": "https://immovia-production.up.railway.app/landing.html?payment=cancelled",
        "webhook_url": "https://immovia-production.up.railway.app/api/subscriptions/webhook"
    }

    try:
        req_data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(
            f"{MONEROO_API_URL}/payments/initialize",
            data=req_data,
            headers={
                "Authorization": f"Bearer {MONEROO_SECRET_KEY}",
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            method='POST'
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            res_body = json.loads(response.read().decode('utf-8'))
            data_obj = res_body.get("data", {})
            checkout_url = data_obj.get("checkout_url")
            
            if not checkout_url:
                raise Exception("checkout_url manquant dans la réponse Moneroo")
                
            return {
                "status": "success",
                "checkout_url": checkout_url,
                "reference": reference,
                "trial_period_days": trial_days
            }
    except Exception as e:
        error_details = ""
        if hasattr(e, 'read'):
            try:
                error_details = e.read().decode('utf-8')
                print(f"Moneroo API Error Details: {error_details}")
            except:
                pass
        print(f"Moneroo API Direct Call Error: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de l'initialisation du paiement sécurisé avec Moneroo.")

@router.post("/webhook")
async def moneroo_webhook(request: Request, db: Session = Depends(database.get_db)):
    """
    Webhook pour recevoir la confirmation de prélèvement ou de souscription depuis Moneroo.
    """
    try:
        data = await request.json()
        print("Moneroo Webhook Received:", data)
        
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
        "gateway": "Moneroo (Axasara)"
    }
