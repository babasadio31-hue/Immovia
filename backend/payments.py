from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from . import database, models, auth

router = APIRouter(prefix="/api/subscriptions", tags=["Subscriptions & Payments"])

@router.get("/status")
def get_subscription_status(current_user: models.User = Depends(auth.get_current_active_user)):
    """
    Renvoie le statut de l'abonnement de l'utilisateur.
    Gère la période d'essai de 3 jours.
    """
    if not current_user.date_added:
        date_added = datetime.now()
    else:
        try:
            # Check format YYYY-MM-DD
            date_added = datetime.strptime(current_user.date_added, "%Y-%m-%d")
        except:
            date_added = datetime.now()
            
    trial_end = date_added + timedelta(days=3)
    now = datetime.now()
    
    # If the super admin sets status to 'Inactif', access is completely denied via auth middleware.
    # If the user is manually marked as 'Abonné' or 'Premium' by admin, we could handle it via a new field,
    # but for now, we rely on current_user.subscription_status if it exists, or just check role.
    
    # Let's say if the user has role 'Administrateur', they might be the agency owner.
    # We will check if trial has expired.
    is_trial_expired = now > trial_end
    
    status_label = "Actif (Essai en cours)"
    
    # Check if the user is already paid
    if getattr(current_user, 'subscription_status', '') == 'Actif_Paye':
        is_trial_expired = False
        status_label = "Actif (Abonné)"
    elif is_trial_expired:
        status_label = "Expiré (Paiement Requis)"
        
    return {
        "user_email": current_user.email,
        "plan": "Premium",
        "status": status_label,
        "amount": "15 000 FCFA / mois",
        "trial_end_date": trial_end.strftime("%d/%m/%Y"),
        "is_trial_expired": is_trial_expired
    }
