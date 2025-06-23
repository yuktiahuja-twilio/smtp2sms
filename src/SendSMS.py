import smtplib

server = smtplib.SMTP('localhost', 8025)

msg = (
    "From: test@yuktiahuja.com\r\n"
    "To: 14155551212@yuktiahuja.com\r\n"
    "Subject: Test\r\n"
    "\r\n"
    "Hello from SMTP2SMS\r\n"
)

server.sendmail(
    "test@yuktiahuja.com",
    ["14155551212@yuktiahuja.com"],
    msg
)

server.quit()
