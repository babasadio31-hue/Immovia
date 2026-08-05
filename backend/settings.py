from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from . import models, schemas, auth

router = APIRouter(prefix="/api/settings", tags=["settings"])

@router.get("/", response_model=schemas.AgencySettingsBase)
def get_settings(db: Session = Depends(auth.get_db), current_user: models.User = Depends(auth.get_current_active_user)):
    settings = db.query(models.AgencySettings).filter(models.AgencySettings.agency_id == current_user.agency_id).first()
    agency = db.query(models.Agency).filter(models.Agency.id == current_user.agency_id).first()
    if agency:
        from datetime import date
        today_str = date.today().strftime("%Y-%m-%d")
        if agency.subscription_expiry and today_str > agency.subscription_expiry and agency.subscription_status != "Expiré":
            agency.subscription_status = "Expiré"
            db.commit()
    sub_plan = agency.subscription_plan if agency else "Essai 3 jours"
    sub_status = agency.subscription_status if agency else "Actif"
    sub_expiry = agency.subscription_expiry if agency else None

    if not settings:
        return schemas.AgencySettingsBase(
            name=agency.name if agency and agency.name else "Immovii S.A.R.L",
            address="Adresse non renseignée",
            phone=agency.phone if agency and agency.phone else "+223 20 22 44 66",
            email=agency.email if agency and agency.email else "contact@immovii.ml",
            currency="FCFA",
            commission_rate=10.0,
            subscription_plan=sub_plan,
            subscription_status=sub_status,
            subscription_expiry=sub_expiry
        )
    res = schemas.AgencySettingsBase.model_validate(settings)
    res.subscription_plan = sub_plan
    res.subscription_status = sub_status
    res.subscription_expiry = sub_expiry
    return res

@router.put("/", response_model=schemas.AgencySettingsBase)
def update_settings(settings_in: schemas.AgencySettingsBase, db: Session = Depends(auth.get_db), current_user: models.User = Depends(auth.get_current_active_user)):
    db_settings = db.query(models.AgencySettings).filter(models.AgencySettings.agency_id == current_user.agency_id).first()
    if not db_settings:
        db_settings = models.AgencySettings(agency_id=current_user.agency_id)
        db.add(db_settings)
    
    agency = db.query(models.Agency).filter(models.Agency.id == current_user.agency_id).first()
    
    data = settings_in.model_dump(exclude_unset=True)
    for key, value in data.items():
        if key not in ['agency_id', 'subscription_plan', 'subscription_status', 'subscription_expiry']:
            setattr(db_settings, key, value)
            if agency and key == 'name':
                agency.name = value
            elif agency and key == 'email':
                agency.email = value
            elif agency and key == 'phone':
                agency.phone = value
        
    db.commit()
    db.refresh(db_settings)
    
    res = schemas.AgencySettingsBase.model_validate(db_settings)
    if agency:
        res.subscription_plan = agency.subscription_plan if agency.subscription_plan else "Essai 3 jours"
        res.subscription_status = agency.subscription_status if agency.subscription_status else "Actif"
        res.subscription_expiry = agency.subscription_expiry
    return res
