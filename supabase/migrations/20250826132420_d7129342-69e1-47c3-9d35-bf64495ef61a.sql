-- Create helper functions for RLS policies
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS app_role
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid();
$$;

-- Create function for auto profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, role)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'display_name', 'admin');
  RETURN NEW;
END;
$$;

-- Create trigger for automatic profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for products
CREATE POLICY "Authenticated users can view products" ON public.products
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin and operador can insert products" ON public.products
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND 
    public.get_current_user_role() IN ('admin', 'operador')
  );

CREATE POLICY "Admin and operador can update products" ON public.products
  FOR UPDATE USING (
    auth.uid() IS NOT NULL AND 
    public.get_current_user_role() IN ('admin', 'operador')
  );

CREATE POLICY "Only admin can delete products" ON public.products
  FOR DELETE USING (
    auth.uid() IS NOT NULL AND 
    public.get_current_user_role() = 'admin'
  );

-- RLS Policies for clients
CREATE POLICY "Authenticated users can view clients" ON public.clients
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin and operador can insert clients" ON public.clients
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND 
    public.get_current_user_role() IN ('admin', 'operador')
  );

CREATE POLICY "Admin and operador can update clients" ON public.clients
  FOR UPDATE USING (
    auth.uid() IS NOT NULL AND 
    public.get_current_user_role() IN ('admin', 'operador')
  );

CREATE POLICY "Only admin can delete clients" ON public.clients
  FOR DELETE USING (
    auth.uid() IS NOT NULL AND 
    public.get_current_user_role() = 'admin'
  );

-- RLS Policies for orders
CREATE POLICY "Authenticated users can view orders" ON public.orders
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin and operador can insert orders" ON public.orders
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND 
    public.get_current_user_role() IN ('admin', 'operador')
  );

CREATE POLICY "Admin and operador can update orders" ON public.orders
  FOR UPDATE USING (
    auth.uid() IS NOT NULL AND 
    public.get_current_user_role() IN ('admin', 'operador')
  );

CREATE POLICY "Only admin can delete orders" ON public.orders
  FOR DELETE USING (
    auth.uid() IS NOT NULL AND 
    public.get_current_user_role() = 'admin'
  );

-- RLS Policies for order_items
CREATE POLICY "Authenticated users can view order items" ON public.order_items
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin and operador can insert order items" ON public.order_items
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND 
    public.get_current_user_role() IN ('admin', 'operador')
  );

CREATE POLICY "Admin and operador can update order items" ON public.order_items
  FOR UPDATE USING (
    auth.uid() IS NOT NULL AND 
    public.get_current_user_role() IN ('admin', 'operador')
  );

CREATE POLICY "Only admin can delete order items" ON public.order_items
  FOR DELETE USING (
    auth.uid() IS NOT NULL AND 
    public.get_current_user_role() = 'admin'
  );

-- RLS Policies for investments
CREATE POLICY "Authenticated users can view investments" ON public.investments
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only admin can manage investments" ON public.investments
  FOR ALL USING (
    auth.uid() IS NOT NULL AND 
    public.get_current_user_role() = 'admin'
  );

-- RLS Policies for expired_products
CREATE POLICY "Authenticated users can view expired products" ON public.expired_products
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin and operador can manage expired products" ON public.expired_products
  FOR ALL USING (
    auth.uid() IS NOT NULL AND 
    public.get_current_user_role() IN ('admin', 'operador')
  );

-- RLS Policies for audit_logs
CREATE POLICY "Only admin can view audit logs" ON public.audit_logs
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND 
    public.get_current_user_role() = 'admin'
  );