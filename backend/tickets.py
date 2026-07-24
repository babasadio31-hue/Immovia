from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
import uuid
import datetime

from .database import get_db
from .auth import get_current_user
from . import models

router = APIRouter(prefix="/api/tickets", tags=["tickets"])

class TicketCreate(BaseModel):
    subject: str
    category: str
    priority: str
    message: str

class TicketResponse(BaseModel):
    id: str
    subject: str
    category: str
    priority: str
    message: str
    status: str
    date: str
    
    class Config:
        orm_mode = True

@router.post("/", response_model=TicketResponse)
def create_ticket(ticket: TicketCreate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    # Check if user has an agency
    agency = db.query(models.Agency).filter(models.Agency.owner_id == current_user.id).first()
    
    new_ticket = models.SupportTicket(
        id=f"TKT-{uuid.uuid4().hex[:8].upper()}",
        agency_id=agency.id if agency else None,
        user_id=current_user.id,
        subject=ticket.subject,
        category=ticket.category,
        priority=ticket.priority,
        message=ticket.message,
        status="Ouvert",
        date=datetime.datetime.utcnow().isoformat() + "Z"
    )
    
    db.add(new_ticket)
    db.commit()
    db.refresh(new_ticket)
    
    return new_ticket

@router.get("/", response_model=List[TicketResponse])
def get_tickets(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    tickets = db.query(models.SupportTicket).filter(models.SupportTicket.user_id == current_user.id).all()
    return tickets
