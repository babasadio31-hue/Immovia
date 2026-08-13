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

class TicketMessageCreate(BaseModel):
    message: str

class TicketMessageResponse(BaseModel):
    id: int
    ticket_id: str
    sender_id: str
    sender_role: str
    message: str
    date: str
    
    class Config:
        from_attributes = True

class TicketResponse(BaseModel):
    id: str
    subject: str
    category: str
    priority: str
    message: str
    status: str
    date: str
    
    class Config:
        from_attributes = True

@router.post("/", response_model=TicketResponse)
def create_ticket(ticket: TicketCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    new_ticket = models.SupportTicket(
        id=f"TKT-{uuid.uuid4().hex[:8].upper()}",
        agency_id=current_user.agency_id,
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
def get_tickets(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    tickets = db.query(models.SupportTicket).filter(models.SupportTicket.agency_id == current_user.agency_id).order_by(models.SupportTicket.date.desc()).all()
    return tickets

@router.get("/{ticket_id}/messages", response_model=List[TicketMessageResponse])
def get_ticket_messages(ticket_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Verify ticket belongs to agency
    ticket = db.query(models.SupportTicket).filter(
        models.SupportTicket.id == ticket_id,
        models.SupportTicket.agency_id == current_user.agency_id
    ).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    messages = db.query(models.TicketMessage).filter(models.TicketMessage.ticket_id == ticket_id).order_by(models.TicketMessage.date.asc()).all()
    return messages

@router.post("/{ticket_id}/messages", response_model=TicketMessageResponse)
def add_ticket_message(ticket_id: str, msg: TicketMessageCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    ticket = db.query(models.SupportTicket).filter(
        models.SupportTicket.id == ticket_id,
        models.SupportTicket.agency_id == current_user.agency_id
    ).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    new_msg = models.TicketMessage(
        ticket_id=ticket_id,
        sender_id=current_user.id,
        sender_role="Agence",
        message=msg.message,
        date=datetime.datetime.utcnow().isoformat() + "Z"
    )
    db.add(new_msg)
    
    # Update ticket status if it was not 'Ouvert'
    ticket.status = "En cours"
    
    db.commit()
    db.refresh(new_msg)
    return new_msg
