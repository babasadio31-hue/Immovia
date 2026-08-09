# -*- coding: utf-8 -*-
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.orm import Session
from . import database, models, email_service

router = APIRouter(prefix="/api/communications", tags=["Communications"])

class EmailSendRequest(BaseModel):
    target_type: str  # "individual", "property_tenants", "all_tenants", "all_owners"
    target_id: Optional[str] = None
    subject: str
    message: str
    agency_id: Optional[str] = None
    agency_name: Optional[str] = "Agence Immobilière"

def format_communication_html(subject: str, message: str, agency_name: str = "Agence Immobilière"):
    return f"""
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
        <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 24px 32px; color: #ffffff;">
            <h2 style="margin: 0; font-size: 22px; font-weight: 700;">{agency_name}</h2>
            <p style="margin: 4px 0 0 0; font-size: 14px; opacity: 0.9;">Communication officielle</p>
        </div>
        <div style="padding: 32px; color: #1e293b; font-size: 16px; line-height: 1.6;">
            <h3 style="margin-top: 0; color: #0f172a; font-size: 18px; border-bottom: 2px solid #10b981; padding-bottom: 8px; display: inline-block;">{subject}</h3>
            <div style="margin-top: 20px; white-space: pre-line;">
                {message}
            </div>
        </div>
        <div style="background: #f8fafc; padding: 20px 32px; text-align: center; color: #64748b; font-size: 13px; border-top: 1px solid #e2e8f0;">
            <p style="margin: 0;">Cet e-mail a été envoyé par <strong>{agency_name}</strong>.</p>
            <p style="margin: 4px 0 0 0;">© 2026 Immovii - Tous droits réservés.</p>
        </div>
    </div>
    """

@router.post("/send-email")
def send_communication_email(req: EmailSendRequest, db: Session = Depends(database.get_db)):
    emails = []
    
    # 1. Individual tenant or owner
    if req.target_type == "individual":
        if not req.target_id:
            raise HTTPException(status_code=400, detail="Identifiant du destinataire manquant.")
        tenant = db.query(models.Tenant).filter(models.Tenant.id == req.target_id).first()
        if tenant and tenant.email and "@" in tenant.email:
            emails.append(tenant.email)
        else:
            owner = db.query(models.Owner).filter(models.Owner.id == req.target_id).first()
            if owner and owner.email and "@" in owner.email:
                emails.append(owner.email)

    # 2. Property tenants
    elif req.target_type == "property_tenants":
        if not req.target_id:
            raise HTTPException(status_code=400, detail="Identifiant du bien manquant.")
        tenants = db.query(models.Tenant).filter(models.Tenant.property_id == req.target_id).all()
        for t in tenants:
            if t.email and "@" in t.email:
                emails.append(t.email)

    # 3. All tenants of the agency
    elif req.target_type == "all_tenants":
        query = db.query(models.Tenant)
        if req.agency_id:
            query = query.filter(models.Tenant.agency_id == req.agency_id)
        tenants = query.all()
        for t in tenants:
            if t.email and "@" in t.email and t.email not in emails:
                emails.append(t.email)

    # 4. All owners of the agency
    elif req.target_type == "all_owners":
        query = db.query(models.Owner)
        if req.agency_id:
            query = query.filter(models.Owner.agency_id == req.agency_id)
        owners = query.all()
        for o in owners:
            if o.email and "@" in o.email and o.email not in emails:
                emails.append(o.email)

    else:
        raise HTTPException(status_code=400, detail="Type de ciblage non valide.")

    if not emails:
        raise HTTPException(status_code=400, detail="Aucune adresse e-mail valide trouvée pour le ciblage sélectionné.")

    html_content = format_communication_html(req.subject, req.message, req.agency_name or "Agence Immobilière")
    
    success = email_service.send_mass_email(emails, req.subject, html_content, sender_name=(req.agency_name or "Agence Immobilière"))
    
    try:
        models.log_activity(db, "Communication", f"E-mail groupé ({req.target_type}) envoyé : {req.subject} ({len(emails)} dest.)", agency_id=req.agency_id)
    except Exception:
        pass
        
    return {
        "success": success,
        "message": f"E-mail envoyé avec succès à {len(emails)} destinataire(s)." if success else "Échec de l'envoi de certains e-mails.",
        "recipient_count": len(emails)
    }
