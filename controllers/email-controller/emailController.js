const nodemailer = require("nodemailer");

const config = require("../../config/env");
const ApiError = require("../../utils/apiError");
const { isEmail } = require("../../utils/helpers");

const stripHtml = (html = "") => String(html).replace(/<[^>]*>/g, " ").trim();

/**
 * Send a transactional e-mail.
 *
 * This is a plain async helper, not an Express handler: the original wrapped
 * it in express-async-handler and called it with (data), so failures were
 * silently swallowed by a res object that did not exist.
 */
const sendEmail = async (data = {}) => {
  if (!isEmail(data.to)) {
    throw ApiError.badRequest("A valid recipient email is required");
  }
  if (!data.subject || (!data.html && !data.text)) {
    throw ApiError.badRequest("An email subject and body are required");
  }

  if (!config.email_address || !config.email_password) {
    if (config.isProduction) {
      throw new ApiError(503, "Email delivery is not configured");
    }
    // In development, keep the flow usable without SMTP credentials.
    console.info(
      `[email] SMTP not configured - would send "${data.subject}" to ${data.to}`
    );
    return { skipped: true };
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user: config.email_address, pass: config.email_password },
  });

  try {
    const info = await transporter.sendMail({
      from: config.email_from,
      to: data.to,
      subject: data.subject,
      text: data.text || stripHtml(data.html),
      html: data.html,
    });
    console.info(`Message sent: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error("Failed to send email:", error.message);
    throw ApiError.badGateway("Failed to send email");
  }
};

module.exports = { sendEmail };
