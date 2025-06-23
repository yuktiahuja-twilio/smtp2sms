# SMTP-to-Twilio SMS Gateway

This project provides a scalable SMTP server that receives emails and forwards them as SMS messages using the Twilio API. It is designed to replace legacy "Email-to-SMS" gateways that are being deprecated by telco carriers.

---

## How It Works

1. **Legacy System** sends an email to `phonenumber@carrier.example` (e.g., `14155551212@carrier.example` or `+14155551212@carrier.example`).
2. **This SMTP Server** receives the email, extracts the phone number, normalizes it to E.164 (if not already), and uses the email body as the SMS message.
   - If the user part of the email address is already in E.164 format (e.g., `+14155551212`), it is accepted as-is.
   - If it is not in E.164, the server will attempt to convert it using the default region (e.g., `14155551212` becomes `+14155551212` if `DEFAULT_REGION=US`).
3. **Twilio API** is used to send the SMS to the intended recipient.

---

## Architecture Diagram

```mermaid
flowchart LR
    A[Legacy App or Service] -- SMTP --> B[SMTP-to-Twilio Gateway]
    B -- "Twilio API" --> C[Twilio]
    C -- "SMS" --> D[Recipient Phone]
```
*Note: The SMTP message is sent to an address like `phonenumber@carrier.example` (e.g., `14155551212@carrier.example`).*

---

## Deployment Instructions

### 1. Prerequisites

- Node.js v18+ and npm
- Twilio account with SMS enabled
- (Optional) Docker, if containerizing

### 2. Install Dependencies

```sh
npm install
```

### 3. Configure Environment

Create a `.env` file in the project root:

```
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number
SMTP_PORT=8025
DEFAULT_REGION=US
```

- `TWILIO_PHONE_NUMBER` must be a Twilio-verified number in E.164 format (e.g., +18085551234).
- `DEFAULT_REGION` is used for phone number normalization (default: US).

### 4. Running the Server

#### Locally

```sh
node src/server.js
```

#### With Docker

Create a `Dockerfile` (see below), then:

```sh
docker build -t smtp2sms .
docker run --env-file .env -p 8025:8025 smtp2sms
```

#### As a Service (systemd example)

Create a `smtp2sms.service` file:

```
[Unit]
Description=SMTP to Twilio SMS Gateway
After=network.target

[Service]
WorkingDirectory=/path/to/project
ExecStart=/usr/bin/node src/server.js
Restart=always
EnvironmentFile=/path/to/project/.env

[Install]
WantedBy=multi-user.target
```

---

## DNS/Hosts Override for Legacy Code

To redirect legacy systems to this server, override the carrier domain in `/etc/hosts` (or equivalent):

```
# On the legacy system
127.0.0.1   carrier.example
```

- Replace `carrier.example` with the domain used in the legacy code.
- Point it to the IP address of the server running this gateway.

---

## Testing

You can test the SMTP-to-Twilio SMS gateway from Linux, macOS, or Windows using several methods.

### 1. Using swaks (Recommended, Cross-Platform)

[swaks](https://www.jetmore.org/john/code/swaks/) is a flexible SMTP testing tool.

#### Install swaks

- **macOS (with Homebrew):**
  ```sh
  brew install swaks
  ```
- **Linux (Debian/Ubuntu):**
  ```sh
  sudo apt-get install swaks
  ```
- **Windows:**
  - Download the Windows executable from [swaks releases](https://github.com/jetmore/swaks/releases).
  - Or, use [Windows Subsystem for Linux (WSL)](https://learn.microsoft.com/en-us/windows/wsl/) and install as above.

#### Send a Test SMS

```sh
swaks --to "14155551212@carrier.example" --server localhost -p 8025 --body "Hello from SMTP2SMS"
```

- Replace `14155551212` with your test phone number.
- Replace `carrier.example` with the domain you are using (or as overridden in `/etc/hosts`).

### 2. Using Command Line (Linux/macOS)

You can use the built-in `sendmail` or `mail` command:

```sh
echo "Hello from SMTP2SMS" | mail -s "Test" -S smtp=localhost:8025 14155551212@carrier.example
```

Or with `sendmail`:

```sh
echo -e "Subject: Test\n\nHello from SMTP2SMS" | sendmail -S localhost:8025 14155551212@carrier.example
```

### 3. Using PowerShell on Windows

Windows PowerShell has a built-in SMTP client:

```powershell
Send-MailMessage -To "14155551212@carrier.example" -From "test@yourdomain.com" -Subject "Test" -Body "Hello from SMTP2SMS" -SmtpServer "localhost" -Port 8025
```

- Run this in a PowerShell window.

### 4. Using Python (Any OS)

If you have Python installed:

```python
import smtplib

server = smtplib.SMTP('localhost', 8025)
server.sendmail(
    "test@yourdomain.com",
    "14155551212@carrier.example",
    "Subject: Test\n\nHello from SMTP2SMS"
)
server.quit()
```

### 5. Verifying Delivery

- Watch the server logs for lines like:
  ```
  SMS sent to +14155551212 (SID: ...)
  ```
- Check the recipient phone for the SMS.

---

## Example Usage

Send a test SMS using [swaks](https://www.jetmore.org/john/code/swaks/):

```sh
swaks --to "14155551212@carrier.example" --server localhost -p 8025 --body "Hello from SMTP2SMS"
```

- The server will extract `14155551212`, normalize it, and send the SMS via Twilio.

---

## Twilio Setup

1. Sign up at [Twilio](https://www.twilio.com/).
2. Buy a phone number with SMS capability.
3. Get your Account SID and Auth Token from the Twilio Console.
4. Set these in your `.env` file.

---

---
## Security and On-Premises Deployment

**Security Warning:** This gateway acts as an open SMTP server to receive messages from legacy applications. Running an open email server exposes you to significant security risks, including abuse by spammers, data leakage, and compliance violations. 

**Best Practices:**
- **Restrict Access:** Only allow trusted internal systems or networks to connect to the SMTP server. Use firewalls, network ACLs, or VPNs to limit exposure.
- **Authentication:** If possible, enable SMTP authentication and TLS encryption to prevent unauthorized use.
- **Monitor and Audit:** Regularly review logs for suspicious activity and keep your server software up to date.
- **On-Premises Deployment:** For legacy applications that cannot be easily updated, it is strongly recommended to deploy this gateway on-premises, within your secure internal network. Do not expose the SMTP server to the public internet.
- **Plan for Migration:** Email-to-SMS gateways are being deprecated and heavily filtered by carriers. Begin planning to migrate legacy workflows to direct API-based SMS delivery (e.g., Twilio SMS API) for improved reliability and security.

---
## Scaling and Production Notes

- For production, run behind a reverse proxy (e.g., Nginx) and use process managers (PM2, systemd).
- Add SMTP authentication and TLS for security.
- Use a queue (e.g., Redis, RabbitMQ) for high-throughput or retry logic.
- Monitor logs and Twilio delivery status.

---

## Dockerfile Example

```Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
CMD ["node", "src/server.js"]
EXPOSE 8025
```

---

## Troubleshooting

- Check logs for errors (invalid phone numbers, Twilio errors, etc.).
- Ensure Twilio credentials and phone number are correct.
- Make sure the SMTP port is open and not blocked by firewalls.

---

## License

MIT
