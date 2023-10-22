module.exports = {
    server_port: process.env.PORT,
    db_connection: process.env.MONGO_URI,
    jwt_secret: process.env.JWT_SECRET,
    email_address: process.env.EMAIL_ADDRESS,
    email_password: process.env.EMAIL_PASSWORD,
    cloud_name: process.env.CLOUD_NAME,
    cloud_api_key: process.env.CLOUD_API_KEY,
    cloud_api_secret: process.env.CLOUD_API_SECRET,
    paypal_client_secret: process.env.PAYPAL_CLIENT_SECRET,
    paypal_client_id: process.env.PAYPAL_CLIENT_ID
}
