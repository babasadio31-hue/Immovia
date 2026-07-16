from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from . import models, schemas, auth

router = APIRouter(prefix="/api/transactions", tags=["transactions"])

@router.get("/", response_model=List[schemas.Transaction])
def read_transactions(skip: int = 0, limit: int = 1000, db: Session = Depends(auth.get_db), current_user: models.User = Depends(auth.get_current_active_user)):
    transactions = db.query(models.Transaction).offset(skip).limit(limit).all()
    return transactions

@router.post("/", response_model=schemas.Transaction)
def create_transaction(transaction: schemas.TransactionCreate, db: Session = Depends(auth.get_db), current_user: models.User = Depends(auth.get_current_active_user)):
    db_transaction = db.query(models.Transaction).filter(models.Transaction.id == transaction.id).first()
    if db_transaction:
        raise HTTPException(status_code=400, detail="Transaction already exists")
    db_transaction = models.Transaction(**transaction.model_dump())
    db.add(db_transaction)
    db.commit()
    db.refresh(db_transaction)
    return db_transaction

@router.put("/{transaction_id}", response_model=schemas.Transaction)
def update_transaction(transaction_id: str, transaction: schemas.TransactionBase, db: Session = Depends(auth.get_db), current_user: models.User = Depends(auth.get_current_active_user)):
    db_transaction = db.query(models.Transaction).filter(models.Transaction.id == transaction_id).first()
    if not db_transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    for key, value in transaction.model_dump().items():
        setattr(db_transaction, key, value)
        
    db.commit()
    db.refresh(db_transaction)
    return db_transaction

@router.delete("/{transaction_id}")
def delete_transaction(transaction_id: str, db: Session = Depends(auth.get_db), current_user: models.User = Depends(auth.get_current_active_user)):
    db_transaction = db.query(models.Transaction).filter(models.Transaction.id == transaction_id).first()
    if not db_transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    db.delete(db_transaction)
    db.commit()
    return {"ok": True}
