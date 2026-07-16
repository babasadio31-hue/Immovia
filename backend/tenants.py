from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from . import models, schemas, auth

router = APIRouter(prefix="/api/tenants", tags=["tenants"])

@router.get("/", response_model=List[schemas.Tenant])
def read_tenants(skip: int = 0, limit: int = 100, db: Session = Depends(auth.get_db), current_user: models.User = Depends(auth.get_current_active_user)):
    tenants = db.query(models.Tenant).offset(skip).limit(limit).all()
    return tenants

@router.post("/", response_model=schemas.Tenant)
def create_tenant(tenant: schemas.TenantCreate, db: Session = Depends(auth.get_db), current_user: models.User = Depends(auth.get_current_active_user)):
    db_tenant = db.query(models.Tenant).filter(models.Tenant.id == tenant.id).first()
    if db_tenant:
        raise HTTPException(status_code=400, detail="Tenant already exists")
    db_tenant = models.Tenant(**tenant.model_dump())
    db.add(db_tenant)
    db.commit()
    db.refresh(db_tenant)
    return db_tenant

@router.put("/{tenant_id}", response_model=schemas.Tenant)
def update_tenant(tenant_id: str, tenant: schemas.TenantBase, db: Session = Depends(auth.get_db), current_user: models.User = Depends(auth.get_current_active_user)):
    db_tenant = db.query(models.Tenant).filter(models.Tenant.id == tenant_id).first()
    if not db_tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    for key, value in tenant.model_dump().items():
        setattr(db_tenant, key, value)
        
    db.commit()
    db.refresh(db_tenant)
    return db_tenant

@router.delete("/{tenant_id}")
def delete_tenant(tenant_id: str, db: Session = Depends(auth.get_db), current_user: models.User = Depends(auth.get_current_active_user)):
    db_tenant = db.query(models.Tenant).filter(models.Tenant.id == tenant_id).first()
    if not db_tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    db.delete(db_tenant)
    db.commit()
    return {"ok": True}
