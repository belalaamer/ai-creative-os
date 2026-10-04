update public.billing_plans set included_seats = 3, updated_at = now() where plan_key = 'trial';
