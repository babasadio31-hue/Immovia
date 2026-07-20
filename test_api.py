import requests

login_data = {"username": "admin", "password": "password"}
r1 = requests.post("http://localhost:8085/api/auth/token", data=login_data)
token = r1.json().get("access_token")
print("Token:", token)

headers = {"Authorization": f"Bearer {token}"}
owner_data = {
    "id": "own-9999",
    "type": "Particulier",
    "name": "Test Owner",
    "phone": "1234",
    "email": "",
    "address": "123 St",
    "commissionRate": 10
}
r2 = requests.post("http://localhost:8085/api/owners/", json=owner_data, headers=headers)
print("Status:", r2.status_code)
print("Response:", r2.text)
