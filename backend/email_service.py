import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

SMTP_SERVER = "smtp-relay.brevo.com"
SMTP_PORT = 587
SMTP_USER = "b31862001@smtp-brevo.com"
SMTP_PASSWORD = "EPOHNQwLxjy2ARtk"

# Expéditeur par défaut (à changer si tu as un domaine validé sur Brevo)
DEFAULT_SENDER = "bbcongo99@gmail.com" 

def send_email(to_email: str, subject: str, html_content: str):
    msg = MIMEMultipart("alternative")
    msg['Subject'] = subject
    msg['From'] = DEFAULT_SENDER
    msg['To'] = to_email

    part = MIMEText(html_content, 'html')
    msg.attach(part)

    try:
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(DEFAULT_SENDER, to_email, msg.as_string())
        server.quit()
        return True
    except Exception as e:
        print(f"Erreur d'envoi d'e-mail à {to_email}: {e}")
        return False

def send_mass_email(to_emails: list, subject: str, html_content: str):
    if not to_emails:
        return True
    try:
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        
        for email in to_emails:
            msg = MIMEMultipart("alternative")
            msg['Subject'] = subject
            msg['From'] = DEFAULT_SENDER
            msg['To'] = email
            msg.attach(MIMEText(html_content, 'html'))
            
            try:
                server.sendmail(DEFAULT_SENDER, email, msg.as_string())
            except Exception as e:
                print(f"Failed to send to {email}: {e}")
                
        server.quit()
        return True
    except Exception as e:
        print(f"Erreur de connexion globale SMTP : {e}")
        return False
