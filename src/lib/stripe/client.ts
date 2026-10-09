import "server-only";
import Stripe from "stripe";
import { HttpError } from "../supabase/server";
export function stripeClient() { if (!process.env.STRIPE_SECRET_KEY) throw new HttpError(503, "Billing is not configured yet."); return new Stripe(process.env.STRIPE_SECRET_KEY); }
export function appUrl() { return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"; }
