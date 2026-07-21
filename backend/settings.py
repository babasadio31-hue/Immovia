from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from . import models, schemas, auth

router = APIRouter(prefix="/api/settings", tags=["settings"])

@router.get("/", response_model=schemas.AgencySettingsBase)
def get_settings(db: Session = Depends(auth.get_db), current_user: models.User = Depends(auth.get_current_active_user)):
    settings = db.query(models.AgencySettings).first()
    if not settings:
        return schemas.AgencySettingsBase(
            name="Immovi S.A.R.L",
            address="Rue du Golf, Immeuble Horizon, Bamako, Mali",
            phone="+223 20 22 44 66",
            email="contact@immovi.ml",
            currency="FCFA",
            commission_rate=10.0
        )
    return settings

@router.put("/", response_model=schemas.AgencySettingsBase)
def update_settings(settings_in: schemas.AgencySettingsBase, db: Session = Depends(auth.get_db), current_user: models.User = Depends(auth.get_current_active_user)):
    db_settings = db.query(models.AgencySettings).first()
    if not db_settings:
        db_settings = models.AgencySettings(id=1)
        db.add(db_settings)
    
    data = settings_in.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(db_settings, key, value)
        
    db.commit()
    db.refresh(db_settings)
    return db_settings
