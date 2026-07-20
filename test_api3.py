# -*- coding: utf-8 -*-
import requests

login_data = {"username": "admin@immovi.com", "password": "admin123"}
r1 = requests.post("http://localhost:8085/api/auth/token", data=login_data)
token = r1.json().get("access_token")
print("Token:", token)

headers = {"Authorization": f"Bearer {token}"}
owner_data = {
    "id": "own-9999",
    "type": "Particulier",
    "name": "Test Owner",
    "phone": "1234",
    "email": "test@test.com",
    "address": "123 St",
    "commissionRate": 10
}
r2 = requests.post("http://localhost:8085/api/owners/", json=owner_data, headers=headers)
print("Owner Status:", r2.status_code)
print("Owner Response:", r2.text)

prop_data = {
    "id": "prop-9999",
    "name": "Test Prop",
    "address": "456 St",
    "type": "Villa",
    "transaction_type": "Location",
    "caution_amount": 0,
    "owner_id": "own-9999",
    "rent_amount": 100,
    "price": 100,
    "commission_rate": 10,
    "status": "Occupe",
    "surface": 0,
    "units": 1
}
r3 = requests.post("http://localhost:8085/api/properties/", json=prop_data, headers=headers)
print("Prop Status:", r3.status_code)
print("Prop Response:", r3.text)
