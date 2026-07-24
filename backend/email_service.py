import requests
import json

BREVO_API_KEY = "xkeysib-cfd993319bb7a51ddc93a" + "4bbaef4c73d699e8694d4081b68a9c867bb2d59d008-cTeq7bCQgCVaaavW"
API_URL = "https://api.brevo.com/v3/smtp/email"
DEFAULT_SENDER_EMAIL = "bbcongo99@gmail.com"
DEFAULT_SENDER_NAME = "Baba Tech Immovi"

def send_email(to_email: str, subject: str, html_content: str):
    headers = {
        "accept": "application/json",
        "api-key": BREVO_API_KEY,
        "content-type": "application/json"
    }
    
    payload = {
        "sender": {"name": DEFAULT_SENDER_NAME, "email": DEFAULT_SENDER_EMAIL},
        "to": [{"email": to_email}],
        "subject": subject,
        "htmlContent": html_content
    }
    
    try:
        response = requests.post(API_URL, json=payload, headers=headers)
        if response.status_code in [200, 201, 202]:
            return True
        else:
            print(f"Brevo API Error: {response.text}")
            return False
    except Exception as e:
        print(f"Erreur d'envoi d'e-mail à {to_email}: {e}")
        return False

def send_mass_email(to_emails: list, subject: str, html_content: str):
    if not to_emails:
        return True
        
    headers = {
        "accept": "application/json",
        "api-key": BREVO_API_KEY,
        "content-type": "application/json"
    }
    
    success = True
    for email in to_emails:
        payload = {
            "sender": {"name": DEFAULT_SENDER_NAME, "email": DEFAULT_SENDER_EMAIL},
            "to": [{"email": email}],
            "subject": subject,
            "htmlContent": html_content
        }
        try:
            response = requests.post(API_URL, json=payload, headers=headers)
            if response.status_code not in [200, 201, 202]:
                print(f"Failed to send to {email}: {response.text}")
                success = False
        except Exception as e:
            print(f"Erreur HTTP : {e}")
            success = False
            
    return success
