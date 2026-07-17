# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from . import models, schemas, auth

router = APIRouter(prefix="/api/owners", tags=["owners"])

@router.get("/", response_model=List[schemas.Owner])
def read_owners(skip: int = 0, limit: int = 100, db: Session = Depends(auth.get_db), current_user: models.User = Depends(auth.get_current_active_user)):
    owners = db.query(models.Owner).offset(skip).limit(limit).all()
    return owners

@router.post("/", response_model=schemas.Owner)
def create_owner(owner: schemas.OwnerCreate, db: Session = Depends(auth.get_db), current_user: models.User = Depends(auth.get_current_active_user)):
    db_owner = db.query(models.Owner).filter(models.Owner.id == owner.id).first()
    if db_owner:
        raise HTTPException(status_code=400, detail="Owner already exists")
    db_owner = models.Owner(**owner.model_dump())
    db.add(db_owner)
    db.commit()
    db.refresh(db_owner)
    return db_owner

@router.put("/{owner_id}", response_model=schemas.Owner)
def update_owner(owner_id: str, owner: schemas.OwnerBase, db: Session = Depends(auth.get_db), current_user: models.User = Depends(auth.get_current_active_user)):
    db_owner = db.query(models.Owner).filter(models.Owner.id == owner_id).first()
    if not db_owner:
        raise HTTPException(status_code=404, detail="Owner not found")
    
    for key, value in owner.model_dump().items():
        setattr(db_owner, key, value)
        
    db.commit()
    db.refresh(db_owner)
    return db_owner

@router.delete("/{owner_id}")
def delete_owner(owner_id: str, db: Session = Depends(auth.get_db), current_user: models.User = Depends(auth.get_current_active_user)):
    db_owner = db.query(models.Owner).filter(models.Owner.id == owner_id).first()
    if not db_owner:
        raise HTTPException(status_code=404, detail="Owner not found")
    
    db.delete(db_owner)
    db.commit()
    return {"ok": True}
