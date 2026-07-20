from sqlalchemy import Column, String, Integer, Float, Boolean, ForeignKey, JSON
from sqlalchemy.orm import relationship
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    phone = Column(String)
    password_hash = Column(String)
    role = Column(String)
    status = Column(String, default="Actif")
    permissions = Column(JSON) # e.g., ["dashboard", "owners", ...]
    date_added = Column(String)

class Owner(Base):
    __tablename__ = "owners"

    id = Column(String, primary_key=True, index=True)
    type = Column(String) # Personne Physique, Personne Morale
    name = Column(String, index=True)
    cni = Column(String)
    phone = Column(String)
    email = Column(String)
    address = Column(String)
    notes = Column(String)
    avatar_url = Column(String, nullable=True)

    properties = relationship("Property", back_populates="owner", cascade="all, delete-orphan")

class Property(Base):
    __tablename__ = "properties"

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

    owner = relationship("Owner", back_populates="properties")
    tenant = relationship("Tenant", back_populates="property", uselist=False, cascade="all, delete-orphan")

class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(String, primary_key=True, index=True)
    property_id = Column(String, ForeignKey("properties.id"))
    name = Column(String)
    phone = Column(String)
    email = Column(String)
    address = Column(String) # previous address
    rent_amount = Column(Float)
    caution_amount = Column(Float)
    entry_date = Column(String)

    property = relationship("Property", back_populates="tenant")

class Transaction(Base):
    __tablename__ = "transactions"

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
    name = Column(String)
    address = Column(String)
    phone = Column(String)
    email = Column(String)
    currency = Column(String)
    commission_rate = Column(Float)
    nif = Column(String)
    slogan = Column(String)
    logo_base64 = Column(String, nullable=True)
