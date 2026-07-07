import type { Request, Response, NextFunction } from "express";
import { getCustomerClient } from "../grpc-clients/customer.client";
import { callGrpc } from "@shared/grpc/call-grpc";
import { signCustomerJWT } from "@shared/auth/jwt";
import {
  CUSTOMER_REFRESH_COOKIE,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
  getRefreshTokenCookie,
  requireRefreshTokenCookie,
} from "@shared/utils/cookies";

export async function registerCustomer(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const {
      email,
      password,
      first_name,
      last_name,
      device_id,
      device_pixel_ratio,
    } = req.body;

    const customerClient = getCustomerClient();
    const response = await callGrpc<any, any>(
      customerClient,
      "RegisterCustomer",
      {
        email,
        password,
        first_name,
        last_name,
        device_id,
        device_pixel_ratio: device_pixel_ratio ?? 1,
      }
    );

    const token = signCustomerJWT({ customer_id: response.customer.id });

    setRefreshTokenCookie(res, CUSTOMER_REFRESH_COOKIE, response.refresh_token);

    res.status(201).json({ token, customer: response.customer });
  } catch (err) {
    next(err);
  }
}

export async function loginCustomer(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email, password, device_id, device_pixel_ratio } = req.body;

    const customerClient = getCustomerClient();
    const response = await callGrpc<any, any>(customerClient, "LoginCustomer", {
      email,
      password,
      device_id,
      device_pixel_ratio: device_pixel_ratio ?? 1,
    });

    const token = signCustomerJWT({ customer_id: response.customer.id });

    setRefreshTokenCookie(res, CUSTOMER_REFRESH_COOKIE, response.refresh_token);

    res.status(200).json({ token, customer: response.customer });
  } catch (err) {
    next(err);
  }
}

export async function oauthLogin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { provider, token, device_id, device_pixel_ratio } = req.body;

    const customerClient = getCustomerClient();
    const response = await callGrpc<any, any>(customerClient, "OAuthLogin", {
      provider,
      token,
      device_id,
      device_pixel_ratio: device_pixel_ratio ?? 1,
    });

    const jwt = signCustomerJWT({ customer_id: response.customer.id });

    setRefreshTokenCookie(res, CUSTOMER_REFRESH_COOKIE, response.refresh_token);

    res.status(200).json({ token: jwt, customer: response.customer });
  } catch (err) {
    next(err);
  }
}

export async function refreshCustomer(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const refreshToken = requireRefreshTokenCookie(
      req,
      CUSTOMER_REFRESH_COOKIE
    );

    const customerClient = getCustomerClient();
    const response = await callGrpc<any, any>(customerClient, "RefreshToken", {
      refresh_token: refreshToken,
    });

    const token = signCustomerJWT({ customer_id: response.customer_id });

    setRefreshTokenCookie(res, CUSTOMER_REFRESH_COOKIE, response.refresh_token);

    res.status(200).json({ token, customer: response.customer });
  } catch (err) {
    next(err);
  }
}

export async function logoutCustomer(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const refreshToken = getRefreshTokenCookie(req, CUSTOMER_REFRESH_COOKIE);

    if (refreshToken) {
      const customerClient = getCustomerClient();
      await callGrpc<any, any>(customerClient, "LogoutCustomer", {
        refresh_token: refreshToken,
      }).catch(() => {});
    }

    clearRefreshTokenCookie(res, CUSTOMER_REFRESH_COOKIE);
    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function getProfile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const customerClient = getCustomerClient();
    const response = await callGrpc<any, any>(customerClient, "GetProfile", {
      customer_id: req.customer!.customer_id,
    });
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { first_name, last_name } = req.body;

    const customerClient = getCustomerClient();
    const response = await callGrpc<any, any>(customerClient, "UpdateProfile", {
      customer_id: req.customer!.customer_id,
      first_name,
      last_name,
    });
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}

export async function getCart(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const customerClient = getCustomerClient();
    const response = await callGrpc<any, any>(customerClient, "GetCart", {
      customer_id: req.customer!.customer_id,
    });
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}

export async function addToCart(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { product_id, quantity } = req.body;

    const customerClient = getCustomerClient();
    const response = await callGrpc<any, any>(customerClient, "AddToCart", {
      customer_id: req.customer!.customer_id,
      product_id,
      quantity,
    });
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}

export async function updateCartItem(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { quantity } = req.body;

    const customerClient = getCustomerClient();
    const response = await callGrpc<any, any>(
      customerClient,
      "UpdateCartItem",
      {
        customer_id: req.customer!.customer_id,
        product_id: req.params.productId,
        quantity,
      }
    );
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}

export async function removeFromCart(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const customerClient = getCustomerClient();
    const response = await callGrpc<any, any>(
      customerClient,
      "RemoveFromCart",
      {
        customer_id: req.customer!.customer_id,
        product_id: req.params.productId,
      }
    );
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}
