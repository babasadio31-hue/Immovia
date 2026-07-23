from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List

from . import models, schemas, auth, database

router = APIRouter(prefix="/api/admin", tags=["admin"])

def get_super_admin(current_user: models.User = Depends(auth.get_current_active_user)):
    if current_user.role not in ["Administrateur", "Super Administrateur"]:
        raise HTTPException(status_code=403, detail="Non autorisé. Réservé aux super administrateurs.")
    return current_user

@router.get("/dashboard")
def get_admin_dashboard(db: Session = Depends(database.get_db), admin: models.User = Depends(get_super_admin)):
    total_users = db.query(models.User).count()
    total_agencies = db.query(models.Agency).count()
    total_owners = db.query(models.Owner).count()
    total_tenants = db.query(models.Tenant).count()
    total_properties = db.query(models.Property).count()
    total_transactions = db.query(models.Transaction).count()
    
    # Calculate revenue (assuming agency subscriptions are tracked in Subscription table)
    # For now just sum from a placeholder
    total_revenue = db.query(func.sum(models.Subscription.amount)).filter(models.Subscription.status == "Payé").scalar() or 0
    
    active_subscriptions = db.query(models.Agency).filter(models.Agency.subscription_status == "Actif").count()
    
    return {
        "stats": {
            "users": total_users,
            "agencies": total_agencies,
            "owners": total_owners,
            "tenants": total_tenants,
            "properties": total_properties,
            "contracts": total_tenants, # Placeholder for contracts
            "transactions": total_transactions,
            "revenue": total_revenue,
            "active_subscriptions": active_subscriptions
        }
    }

@router.get("/users")
def get_all_users(db: Session = Depends(database.get_db), admin: models.User = Depends(get_super_admin)):
    users = db.query(models.User).all()
    # join with agency to get agency info
    result = []
    for user in users:
        agency = db.query(models.Agency).filter(models.Agency.id == user.agency_id).first()
        result.append({
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "phone": user.phone,
            "role": user.role,
            "status": user.status,
            "date_added": user.date_added,
            "agency": agency.name if agency else "Aucune",
            "subscription_plan": agency.subscription_plan if agency else "Essai",
            "subscription_expiry": agency.subscription_expiry if agency else None
        })
    return result

@router.get("/agencies")
def get_all_agencies(db: Session = Depends(database.get_db), admin: models.User = Depends(get_super_admin)):
    return db.query(models.Agency).all()

@router.get("/properties")
def get_all_properties(db: Session = Depends(database.get_db), admin: models.User = Depends(get_super_admin)):
    properties = db.query(models.Property).all()
    result = []
    for prop in properties:
        agency = db.query(models.Agency).filter(models.Agency.id == prop.agency_id).first()
        owner = db.query(models.Owner).filter(models.Owner.id == prop.owner_id).first()
        result.append({
            "id": prop.id,
            "name": prop.name,
            "type": prop.type,
            "status": prop.status,
            "price": prop.price,
            "agency": agency.name if agency else "Aucune",
            "owner": owner.name if owner else "Aucun"
        })
    return result

@router.get("/subscriptions")
def get_all_subscriptions(db: Session = Depends(database.get_db), admin: models.User = Depends(get_super_admin)):
    return db.query(models.Subscription).order_by(models.Subscription.date.desc()).all()

@router.get("/tickets")
def get_all_tickets(db: Session = Depends(database.get_db), admin: models.User = Depends(get_super_admin)):
    return db.query(models.SupportTicket).order_by(models.SupportTicket.date.desc()).all()

@router.get("/activity")
def get_activity_logs(db: Session = Depends(database.get_db), admin: models.User = Depends(get_super_admin)):
    return db.query(models.ActivityLog).order_by(models.ActivityLog.id.desc()).limit(100).all()

@router.put("/users/{user_id}/suspend")
def suspend_user(user_id: str, db: Session = Depends(database.get_db), admin: models.User = Depends(get_super_admin)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    user.status = "Suspendu"
    db.commit()
    return {"message": "Utilisateur suspendu avec succès"}

@router.put("/users/{user_id}/activate")
def activate_user(user_id: str, db: Session = Depends(database.get_db), admin: models.User = Depends(get_super_admin)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    user.status = "Actif"
    db.commit()
    return {"message": "Utilisateur activé avec succès"}

@router.delete("/users/{user_id}")
def delete_user(user_id: str, db: Session = Depends(database.get_db), admin: models.User = Depends(get_super_admin)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    db.delete(user)
    db.commit()
    return {"message": "Utilisateur supprimé"}

@router.get("/users/{user_id}/details")
def get_user_details(user_id: str, db: Session = Depends(database.get_db), admin: models.User = Depends(get_super_admin)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
        
    agency = db.query(models.Agency).filter(models.Agency.id == user.agency_id).first()
    
    properties_count = db.query(models.Property).filter(models.Property.agency_id == user.agency_id).count() if user.agency_id else 0
    owners_count = db.query(models.Owner).filter(models.Owner.agency_id == user.agency_id).count() if user.agency_id else 0
    tenants_count = db.query(models.Tenant).filter(models.Tenant.agency_id == user.agency_id).count() if user.agency_id else 0
    
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "status": user.status,
        "agency_name": agency.name if agency else "Aucune",
        "agency_phone": agency.phone if agency else "Aucun",
        "date_added": user.date_added,
        "properties_count": properties_count,
        "owners_count": owners_count,
        "tenants_count": tenants_count
    }

@router.get("/messages")
def get_contact_messages(db: Session = Depends(database.get_db), admin: models.User = Depends(get_super_admin)):
    messages = db.query(models.ContactMessage).all()
    return messages

class NewsletterRequest(BaseModel):
    subject: str
    content: str
    target: str

@router.post("/newsletters/send")
def send_newsletter(req: NewsletterRequest, db: Session = Depends(database.get_db), admin: models.User = Depends(get_super_admin)):
    import uuid
    from datetime import datetime
    
    # In a real scenario, we would use an SMTP server here
    # For now, we simulate the sending process
    
    if req.target == "agencies":
        count = db.query(models.User).filter(models.User.role == "Admin Agence").count()
    elif req.target == "owners":
        count = db.query(models.Owner).count()
    else:
        count = db.query(models.User).count()
        
    new_campaign = models.NewsletterCampaign(
        id=str(uuid.uuid4()),
        subject=req.subject,
        content=req.content,
        target_audience=req.target,
        status="Envoyé (Simulation)",
        sent_count=count,
        date=datetime.now().strftime("%Y-%m-%d %H:%M")
    )
    db.add(new_campaign)
    db.commit()
    
    return {"message": f"Newsletter envoyée avec succès à {count} destinataires ! (Mode Simulation)"}
