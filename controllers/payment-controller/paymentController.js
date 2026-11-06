const asyncHandler = require("express-async-handler");
const fetch = require("node-fetch");

const config = require("../../config/env");
const ApiError = require("../../utils/apiError");
const { parseAmount } = require("../../utils/helpers");

/** Parse a PayPal response body without crashing on an empty/non-JSON body. */
const readJson = async (response, fallback = {}) => {
  const text = await response.text();
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    throw ApiError.badGateway("PayPal returned an invalid response");
  }
};

const safeFetch = async (url, options) => {
  try {
    return await fetch(url, options);
  } catch (error) {
    console.error("PayPal request failed:", error.message);
    throw ApiError.badGateway("Could not reach PayPal");
  }
};

const handleResponse = async (response) => ({
  jsonResponse: await readJson(response),
  httpStatusCode: response.status,
});

/** Generate an OAuth 2.0 access token for the PayPal REST API. */
const generateAccessToken = async () => {
  if (!config.paypal_client_id || !config.paypal_client_secret) {
    throw new ApiError(
      503,
      "PayPal is not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET."
    );
  }
  const auth = Buffer.from(
    `${config.paypal_client_id}:${config.paypal_client_secret}`
  ).toString("base64");

  const response = await safeFetch(`${config.paypal_base}/v1/oauth2/token`, {
    method: "POST",
    body: "grant_type=client_credentials",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  const data = await readJson(response);
  // The original swallowed all errors and returned `undefined` here.
  if (!response.ok || !data.access_token) {
    console.error("PayPal token error:", data);
    throw ApiError.badGateway("PayPal authentication failed");
  }
  return data.access_token;
};

/** Create an order to start the transaction. */
const createOrder = async (data = {}) => {
  const rawAmount = data?.product?.cost ?? data?.amount ?? data?.total ?? data?.totalPrice;
  if (rawAmount === undefined || rawAmount === null || rawAmount === "") {
    throw ApiError.badRequest("An order amount (product.cost) is required");
  }
  const value = parseAmount(rawAmount, "product.cost");
  if (value <= 0) throw ApiError.badRequest("Order amount must be greater than zero");

  const accessToken = await generateAccessToken();
  const response = await safeFetch(`${config.paypal_base}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: config.paypal_currency,
            value: value.toFixed(2),
          },
        },
      ],
    }),
  });
  return handleResponse(response);
};

/** Capture payment for a created order. */
const captureOrder = async (orderID) => {
  if (!orderID) throw ApiError.badRequest("An orderID is required");
  const accessToken = await generateAccessToken();
  const response = await safeFetch(
    `${config.paypal_base}/v2/checkout/orders/${encodeURIComponent(orderID)}/capture`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: "{}",
    }
  );
  return handleResponse(response);
};

const payment = {
  orders: asyncHandler(async (req, res) => {
    const { jsonResponse, httpStatusCode } = await createOrder(req.body);
    res.status(httpStatusCode).json(jsonResponse);
  }),

  orderId: asyncHandler(async (req, res) => {
    const { jsonResponse, httpStatusCode } = await captureOrder(req.params.orderID);
    res.status(httpStatusCode).json(jsonResponse);
  }),
};

module.exports = { payment };
