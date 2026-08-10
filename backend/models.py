from sqlalchemy import Column, String, Integer, Float, Boolean, ForeignKey, JSON, DateTime
import datetime
from sqlalchemy.orm import relationship
from .database import Base


class Agency(Base):
    __tablename__ = "agencies"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, index=True)
    manager_name = Column(String)
    phone = Column(String)
    email = Column(String, unique=True, index=True)
    property_count = Column(Integer, default=0)
    owner_count = Column(Integer, default=0)
    tenant_count = Column(Integer, default=0)
    contract_count = Column(Integer, default=0)
    subscription_plan = Column(String, default="Essai") # Essai, Starter, Pro, Business
    subscription_status = Column(String, default="Actif") # Actif, Expiré, Suspendu
    subscription_expiry = Column(String, nullable=True)
    status = Column(String, default="Actif")
    date_added = Column(String)
    users = relationship("User", back_populates="agency")
    owners = relationship("Owner", back_populates="agency")
    properties = relationship("Property", back_populates="agency")
    tenants = relationship("Tenant", back_populates="agency")

class User(Base):
    __tablename__ = "users"

    agency_id = Column(String, ForeignKey("agencies.id"), nullable=True)

    id = Column(String, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    phone = Column(String)
    password_hash = Column(String)
    role = Column(String)
    status = Column(String, default="Actif")
    permissions = Column(JSON) # e.g., ["dashboard", "owners", ...]
    date_added = Column(String)
    verification_token = Column(String, nullable=True)
    agency = relationship("Agency", back_populates="users")

class Owner(Base):
    __tablename__ = "owners"

    agency_id = Column(String, ForeignKey("agencies.id"), nullable=True)

    id = Column(String, primary_key=True, index=True)
    type = Column(String) # Personne Physique, Personne Morale
    name = Column(String, index=True)
    cni = Column(String)
    phone = Column(String)
    email = Column(String)
    address = Column(String)
    notes = Column(String)
    avatar_url = Column(String, nullable=True)
    mandate_start = Column(String, nullable=True)
    mandate_end = Column(String, nullable=True)

    properties = relationship("Property", back_populates="owner", cascade="all, delete-orphan")
    agency = relationship("Agency", back_populates="owners")

class Property(Base):
    __tablename__ = "properties"

    agency_id = Column(String, ForeignKey("agencies.id"), nullable=True)

    id = Column(String, primary_key=True, index=True)
    owner_id = Column(String, ForeignKey("owners.id"))
    name = Column(String)
    type = Column(String) # Villa, Appartement, etc.
    address = Column(String)
    surface = Column(Integer)
    units = Column(Integer)
    status = Column(String) # Occupé, Vacant, En travaux, Disponible à la vente, Vendu
    transaction_type = Column(String, default="Location") # Location, Vente
    price = Column(Float, nullable=True) # Loyer mensuel ou Prix de vente
    caution_amount = Column(Float, nullable=True)
    commission_rate = Column(Float, nullable=True)
    tenant_name = Column(String, nullable=True)
    tenant_phone = Column(String, nullable=True)
    tenant_cni = Column(String, nullable=True)
    mandate_start = Column(String, nullable=True)
    mandate_end = Column(String, nullable=True)

    owner = relationship("Owner", back_populates="properties")
    tenant = relationship("Tenant", back_populates="property", uselist=False, cascade="all, delete-orphan")
    agency = relationship("Agency", back_populates="properties")

class Tenant(Base):
    __tablename__ = "tenants"

    agency_id = Column(String, ForeignKey("agencies.id"), nullable=True)

    id = Column(String, primary_key=True, index=True)
    property_id = Column(String, ForeignKey("properties.id"))
    name = Column(String)
    cni = Column(String, nullable=True)
    phone = Column(String)
    email = Column(String)
    address = Column(String) # previous address
    rent_amount = Column(Float)
    caution_amount = Column(Float)
    entry_date = Column(String)

    property = relationship("Property", back_populates="tenant")
    agency = relationship("Agency", back_populates="tenants")

class Transaction(Base):
    __tablename__ = "transactions"

    agency_id = Column(String, ForeignKey("agencies.id"), nullable=True)

    id = Column(String, primary_key=True, index=True)
    property_id = Column(String, ForeignKey("properties.id"), nullable=True)
    type = Column(String) # income, expense
    amount = Column(Float)
    date = Column(String)
    description = Column(String)
    motif = Column(String, nullable=True) # for expenses

class AgencySettings(Base):
    __tablename__ = "agency_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    agency_id = Column(String, ForeignKey("agencies.id"))
    name = Column(String)
    address = Column(String)
    phone = Column(String)
    email = Column(String)
    currency = Column(String)
    commission_rate = Column(Float)
    nif = Column(String)
    slogan = Column(String)
    logo_base64 = Column(String, nullable=True)


class Subscription(Base):
    __tablename__ = "subscriptions"
    
    id = Column(String, primary_key=True, index=True)
    agency_id = Column(String, ForeignKey("agencies.id"))
    plan = Column(String)
    amount = Column(Float)
    payment_method = Column(String) # Moneroo, Orange Money, etc.
    reference = Column(String)
    date = Column(String)
    status = Column(String) # Payé, Échoué, En attente

class SupportTicket(Base):
    __tablename__ = "support_tickets"
    
    id = Column(String, primary_key=True, index=True)
    agency_id = Column(String, ForeignKey("agencies.id", ondelete="CASCADE"))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    subject = Column(String)
    category = Column(String)
    priority = Column(String)
    message = Column(String)
    status = Column(String, default="Ouvert")
    date = Column(String)

class ActivityLog(Base):
    __tablename__ = "activity_logs"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    agency_id = Column(String, ForeignKey("agencies.id", ondelete="CASCADE"), nullable=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    action = Column(String) # e.g., "Connexion", "Paiement", "Création Bien"
    details = Column(String)
    date = Column(String)

class PlatformSettings(Base):
    __tablename__ = "platform_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    logo_url = Column(String, nullable=True)
    favicon_url = Column(String, nullable=True)
    app_name = Column(String, default="Immovii")
    currency = Column(String, default="FCFA")
    languages = Column(JSON, nullable=True)
    api_keys = Column(JSON, nullable=True)
    domain = Column(String, nullable=True)
    payment_settings = Column(JSON, nullable=True)
    email_settings = Column(JSON, nullable=True)


class ContactMessage(Base):
    __tablename__ = "contact_messages"
    
    id = Column(String, primary_key=True, index=True)
    name = Column(String)
    email = Column(String)
    phone = Column(String)
    message = Column(String)
    status = Column(String, default="Non lu")
    date = Column(String)

class NewsletterCampaign(Base):
    __tablename__ = "newsletter_campaigns"
    
    id = Column(String, primary_key=True, index=True)
    subject = Column(String)
    content = Column(String)
    target_audience = Column(String) # "all", "agencies", "owners"
    status = Column(String, default="Envoyé")
    sent_count = Column(Integer, default=0)
    date = Column(String)


class Tutorial(Base):
    __tablename__ = "tutorials"
    
    id = Column(String, primary_key=True, index=True)
    title = Column(String)
    description = Column(String)
    video_url = Column(String, nullable=True)
    date_added = Column(String)


def log_activity(db, action: str, details: str, user_id: str = None, agency_id: str = None):
    try:
        from datetime import datetime
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_entry = ActivityLog(
            action=action,
            details=details,
            date=now_str,
            user_id=user_id,
            agency_id=agency_id
        )
        db.add(log_entry)
        db.commit()
    except Exception as e:
        db.rollback()
