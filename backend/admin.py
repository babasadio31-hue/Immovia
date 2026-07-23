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
