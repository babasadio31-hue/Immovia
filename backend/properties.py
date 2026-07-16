from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from . import models, schemas, auth

router = APIRouter(prefix="/api/properties", tags=["properties"])

@router.get("/", response_model=List[schemas.Property])
def read_properties(skip: int = 0, limit: int = 100, db: Session = Depends(auth.get_db), current_user: models.User = Depends(auth.get_current_active_user)):
    properties = db.query(models.Property).offset(skip).limit(limit).all()
    return properties

@router.post("/", response_model=schemas.Property)
def create_property(prop: schemas.PropertyCreate, db: Session = Depends(auth.get_db), current_user: models.User = Depends(auth.get_current_active_user)):
    db_prop = db.query(models.Property).filter(models.Property.id == prop.id).first()
    if db_prop:
        raise HTTPException(status_code=400, detail="Property already exists")
    db_prop = models.Property(**prop.model_dump())
    db.add(db_prop)
    db.commit()
    db.refresh(db_prop)
    return db_prop

@router.put("/{property_id}", response_model=schemas.Property)
def update_property(property_id: str, prop: schemas.PropertyBase, db: Session = Depends(auth.get_db), current_user: models.User = Depends(auth.get_current_active_user)):
    db_prop = db.query(models.Property).filter(models.Property.id == property_id).first()
    if not db_prop:
        raise HTTPException(status_code=404, detail="Property not found")
    
    for key, value in prop.model_dump().items():
        setattr(db_prop, key, value)
        
    db.commit()
    db.refresh(db_prop)
    return db_prop

@router.delete("/{property_id}")
def delete_property(property_id: str, db: Session = Depends(auth.get_db), current_user: models.User = Depends(auth.get_current_active_user)):
    db_prop = db.query(models.Property).filter(models.Property.id == property_id).first()
    if not db_prop:
        raise HTTPException(status_code=404, detail="Property not found")
    
    db.delete(db_prop)
    db.commit()
    return {"ok": True}
