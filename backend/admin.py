from . import email_service
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List

from . import models, schemas, auth, database
from .tickets import TicketMessageResponse

router = APIRouter(prefix="/api/admin", tags=["admin"])

import os

def get_super_admin(current_user: models.User = Depends(auth.get_current_active_user)):
    admin_email = os.getenv("ADMIN_EMAIL", "admin@immovii.com")
    is_super = (
        current_user.email in [admin_email, "admin@immovii.com", "admin@immovi.com"]
        or current_user.role in ["Super Admin", "Super Administrateur"]
        or current_user.id == "admin-001"
    )
    if not is_super:
        raise HTTPException(status_code=403, detail="Non autorisé. Réservé aux super administrateurs de la plateforme.")
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
            "status": agency.subscription_status if (agency and agency.subscription_status and agency.subscription_status != "Actif") else user.status,
            "date_added": user.date_added,
            "agency": agency.name if agency else "Aucune",
            "subscription_plan": agency.subscription_plan if agency else "Essai",
            "subscription_expiry": agency.subscription_expiry if agency else None
        })
    return result

@router.get("/agencies")
def get_all_agencies(db: Session = Depends(database.get_db), admin: models.User = Depends(get_super_admin)):
    agencies = db.query(models.Agency).all()
    from datetime import date
    today_str = date.today().strftime("%Y-%m-%d")
    changed = False
    for a in agencies:
        if not a.subscription_status:
            a.subscription_status = "Actif"
            changed = True
        if a.subscription_expiry and today_str > a.subscription_expiry and a.subscription_status not in ["Expiré", "Suspendu"]:
            a.subscription_status = "Expiré"
            changed = True
    if changed:
        db.commit()
    return agencies

@router.put("/agencies/{agency_id}")
def update_agency(agency_id: str, agency: schemas.AgencyUpdate, db: Session = Depends(database.get_db), admin: models.User = Depends(get_super_admin)):
    db_agency = db.query(models.Agency).filter(models.Agency.id == agency_id).first()
    if not db_agency:
        raise HTTPException(status_code=404, detail="Agence introuvable")
    
    if agency.name is not None:
        db_agency.name = agency.name
    if agency.manager_name is not None:
        db_agency.manager_name = agency.manager_name
    if agency.email is not None:
        db_agency.email = agency.email
    if agency.phone is not None:
        db_agency.phone = agency.phone
        
    db_settings = db.query(models.AgencySettings).filter(models.AgencySettings.agency_id == agency_id).first()
    if db_settings:
        if agency.name is not None:
            db_settings.name = agency.name
        if agency.email is not None:
            db_settings.email = agency.email
        if agency.phone is not None:
            db_settings.phone = agency.phone
        
    if agency.subscription_plan is not None:
        db_agency.subscription_plan = agency.subscription_plan
        if agency.subscription_status is None:
            db_agency.subscription_status = "Actif"
        from datetime import datetime, timedelta
        now = datetime.now()
        if agency.subscription_plan == "1 mois":
            db_agency.subscription_expiry = (now + timedelta(days=30)).strftime("%Y-%m-%d")
        elif agency.subscription_plan == "3 mois":
            db_agency.subscription_expiry = (now + timedelta(days=90)).strftime("%Y-%m-%d")
        elif agency.subscription_plan == "1 an":
            db_agency.subscription_expiry = (now + timedelta(days=365)).strftime("%Y-%m-%d")
        elif agency.subscription_plan == "Essai":
            db_agency.subscription_expiry = (now + timedelta(days=3)).strftime("%Y-%m-%d")
            
    if agency.subscription_status is not None:
        db_agency.subscription_status = agency.subscription_status
    if agency.subscription_expiry is not None and agency.subscription_expiry.strip() != "":
        db_agency.subscription_expiry = agency.subscription_expiry
        
    for u in db_agency.users:
        u.status = db_agency.subscription_status
            
    db.commit()
    return {"message": "Agence modifiée avec succès"}

@router.delete("/agencies/{agency_id}")
def delete_agency(agency_id: str, db: Session = Depends(database.get_db), admin: models.User = Depends(get_super_admin)):
    db_agency = db.query(models.Agency).filter(models.Agency.id == agency_id).first()
    if not db_agency:
        raise HTTPException(status_code=404, detail="Agence introuvable")
        
    tables_with_agency = [
        models.ActivityLog,
        models.SupportTicket,
        models.Subscription,
        models.AgencySettings,
        models.Transaction,
        models.Tenant,
        models.Property,
        models.Owner,
        models.User
    ]
    for table in tables_with_agency:
        db.query(table).filter(table.agency_id == agency_id).delete(synchronize_session=False)
        
    db.delete(db_agency)
    db.commit()
    return {"message": "Agence et toutes ses données supprimées avec succès"}

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
    tickets = db.query(models.SupportTicket).order_by(models.SupportTicket.date.desc()).all()
    results = []
    for t in tickets:
        user = db.query(models.User).filter(models.User.id == t.user_id).first() if t.user_id else None
        agency = db.query(models.Agency).filter(models.Agency.id == t.agency_id).first() if t.agency_id else None
        results.append({
            "id": t.id,
            "subject": t.subject,
            "category": t.category,
            "priority": t.priority,
            "message": t.message,
            "status": t.status,
            "date": t.date,
            "author": user.name if user else "Anonyme",
            "agency": agency.name if agency else "Aucune",
            "email": user.email if user else "Non spécifié"
        })
    return results

class TicketMessageCreate(BaseModel):
    message: str

@router.get("/tickets/{ticket_id}/messages", response_model=List[TicketMessageResponse])
def get_admin_ticket_messages(ticket_id: str, db: Session = Depends(database.get_db), admin: models.User = Depends(get_super_admin)):
    ticket = db.query(models.SupportTicket).filter(models.SupportTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    messages = db.query(models.TicketMessage).filter(models.TicketMessage.ticket_id == ticket_id).order_by(models.TicketMessage.date.asc()).all()
    return messages

@router.post("/tickets/{ticket_id}/messages", response_model=TicketMessageResponse)
def add_admin_ticket_message(ticket_id: str, msg: TicketMessageCreate, db: Session = Depends(database.get_db), admin: models.User = Depends(get_super_admin)):
    import datetime
    ticket = db.query(models.SupportTicket).filter(models.SupportTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    new_msg = models.TicketMessage(
        ticket_id=ticket_id,
        sender_id=admin.id,
        sender_role="Admin",
        message=msg.message,
        date=datetime.datetime.utcnow().isoformat() + "Z"
    )
    db.add(new_msg)
    
    # Update ticket status
    ticket.status = "Répondu"
    
    db.commit()
    db.refresh(new_msg)
    return new_msg

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
    models.log_activity(db, "Suspension Compte", f"Suspension de l'utilisateur : {user.email}", user_id=user.id, agency_id=user.agency_id)
    return {"message": "Utilisateur suspendu avec succès"}

@router.put("/users/{user_id}/activate")
def activate_user(user_id: str, db: Session = Depends(database.get_db), admin: models.User = Depends(get_super_admin)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    user.status = "Actif"
    db.commit()
    models.log_activity(db, "Activation Compte", f"Activation de l'utilisateur : {user.email}", user_id=user.id, agency_id=user.agency_id)
    return {"message": "Utilisateur activé avec succès"}

@router.delete("/users/{user_id}")
def delete_user(user_id: str, db: Session = Depends(database.get_db), admin: models.User = Depends(get_super_admin)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
        
    agency_id = user.agency_id
    
    # 1. Supprimer les logs et tickets rattachés à cet utilisateur pour ne pas violer de clé étrangère
    db.query(models.ActivityLog).filter(models.ActivityLog.user_id == user_id).delete(synchronize_session=False)
    db.query(models.SupportTicket).filter(models.SupportTicket.user_id == user_id).delete(synchronize_session=False)
    
    # 2. Si c'est le dernier utilisateur d'une agence, nettoyer l'intégralité des données de l'agence AVANT
    if agency_id:
        remaining_users = db.query(models.User).filter(models.User.agency_id == agency_id, models.User.id != user_id).count()
        if remaining_users == 0:
            tables_with_agency = [
                models.ActivityLog,
                models.SupportTicket,
                models.Subscription,
                models.AgencySettings,
                models.Transaction,
                models.Tenant,
                models.Property,
                models.Owner
            ]
            for table in tables_with_agency:
                db.query(table).filter(table.agency_id == agency_id).delete(synchronize_session=False)
                
            db.query(models.Agency).filter(models.Agency.id == agency_id).delete(synchronize_session=False)
            
    # 3. Supprimer enfin l'utilisateur en toute sécurité
    db.delete(user)
    db.commit()

    return {"message": "Utilisateur et ses données supprimés avec succès"}

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
    messages = db.query(models.ContactMessage).order_by(models.ContactMessage.date.desc()).all()
    return messages

@router.put("/messages/{msg_id}/read")
def mark_message_read(msg_id: str, db: Session = Depends(database.get_db), admin: models.User = Depends(get_super_admin)):
    msg = db.query(models.ContactMessage).filter(models.ContactMessage.id == msg_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message introuvable")
    msg.status = "Lu"
    db.commit()
    return {"message": "Message marqué comme lu"}


class NewsletterRequest(BaseModel):
    subject: str
    content: str
    target: str

@router.post("/newsletters/send")
def send_newsletter(req: NewsletterRequest, db: Session = Depends(database.get_db), admin: models.User = Depends(get_super_admin)):
    import uuid
    from datetime import datetime
    
    
    # Récupérer les adresses e-mail cibles
    if req.target == "agencies":
        users = db.query(models.User).filter(models.User.role == "Admin Agence").all()
        emails = [u.email for u in users if u.email]
    elif req.target == "owners":
        owners = db.query(models.Owner).all()
        emails = [o.email for o in owners if o.email]
    else:
        users = db.query(models.User).all()
        emails = [u.email for u in users if u.email]
        
    count = len(emails)
    
    # Appel du service d'envoi réel
    success = email_service.send_mass_email(emails, req.subject, req.content)
    status = "Envoyé" if success else "Échoué"
        
    new_campaign = models.NewsletterCampaign(
        id=str(uuid.uuid4()),
        subject=req.subject,
        content=req.content,
        target_audience=req.target,
        status=status,
        sent_count=count,
        date=datetime.now().strftime("%Y-%m-%d %H:%M")
    )
    db.add(new_campaign)
    db.commit()
    
    if success:
        return {"message": f"Newsletter envoyée avec succès à {count} destinataires !"}
    else:
        raise HTTPException(status_code=500, detail="Erreur lors de l'envoi de la newsletter. Vérifiez les paramètres SMTP.")

# ==================== TUTORIALS ====================

@router.get("/tutorials", response_model=List[schemas.Tutorial])
def get_all_tutorials(db: Session = Depends(database.get_db), admin: models.User = Depends(get_super_admin)):
    return db.query(models.Tutorial).order_by(models.Tutorial.date_added.desc()).all()

@router.post("/tutorials", response_model=schemas.Tutorial)
def create_tutorial(tut: schemas.TutorialCreate, db: Session = Depends(database.get_db), admin: models.User = Depends(get_super_admin)):
    import uuid
    from datetime import datetime
    new_tut = models.Tutorial(
        id=f"tut-{str(uuid.uuid4())[:8]}",
        title=tut.title,
        description=tut.description,
        video_url=tut.video_url,
        date_added=datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    )
    db.add(new_tut)
    db.commit()
    db.refresh(new_tut)
    return new_tut

@router.put("/tutorials/{tut_id}", response_model=schemas.Tutorial)
def update_tutorial(tut_id: str, tut: schemas.TutorialCreate, db: Session = Depends(database.get_db), admin: models.User = Depends(get_super_admin)):
    db_tut = db.query(models.Tutorial).filter(models.Tutorial.id == tut_id).first()
    if not db_tut:
        raise HTTPException(status_code=404, detail="Tutoriel introuvable")
    
    db_tut.title = tut.title
    db_tut.description = tut.description
    db_tut.video_url = tut.video_url
    
    db.commit()
    db.refresh(db_tut)
    return db_tut

@router.delete("/tutorials/{tut_id}")
def delete_tutorial(tut_id: str, db: Session = Depends(database.get_db), admin: models.User = Depends(get_super_admin)):
    db_tut = db.query(models.Tutorial).filter(models.Tutorial.id == tut_id).first()
    if not db_tut:
        raise HTTPException(status_code=404, detail="Tutoriel introuvable")
    
    db.delete(db_tut)
    db.commit()
    return {"message": "Tutoriel supprimé avec succès"}
