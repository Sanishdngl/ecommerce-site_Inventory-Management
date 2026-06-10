import type { Request, Response, NextFunction } from "express";
import { getCustomerClient } from "../grpc-clients/customer.client";
import { callGrpc } from "../grpc-clients/index";
import { signCustomerJWT } from "@shared/jwt";

export async function registerCustomer(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email, password, first_name, last_name } = req.body;

    const customerClient = getCustomerClient();
    const response = await callGrpc<any, any>(
      customerClient,
      "RegisterCustomer",
      { email, password, first_name, last_name }
    );

    const token = signCustomerJWT({ customer_id: response.customer.id });

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
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: "email and password are required" });
      return;
    }

    const customerClient = getCustomerClient();
    const response = await callGrpc<any, any>(customerClient, "LoginCustomer", {
      email,
      password,
    });

    const token = signCustomerJWT({ customer_id: response.customer.id });

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
    const { provider, token } = req.body;

    if (!provider || !token) {
      res.status(400).json({ message: "provider and token are required" });
      return;
    }

    const customerClient = getCustomerClient();
    const response = await callGrpc<any, any>(customerClient, "OAuthLogin", {
      provider,
      token,
    });

    const jwt = signCustomerJWT({ customer_id: response.customer.id });

    res.status(200).json({ token: jwt, customer: response.customer });
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

    if (!product_id || !quantity) {
      res.status(400).json({ message: "product_id and quantity are required" });
      return;
    }

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

    if (!quantity) {
      res.status(400).json({ message: "quantity is required" });
      return;
    }

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
