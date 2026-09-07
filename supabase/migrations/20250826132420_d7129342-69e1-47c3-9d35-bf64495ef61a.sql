SET search_path TO vertex, extensions;

-- Create helper functions for RLS policies
CREATE OR REPLACE FUNCTION vertex.get_current_user_role()
RETURNS app_role
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM vertex.profiles WHERE user_id = auth.uid();
$$;

-- Create function for auto profile creation
CREATE OR REPLACE FUNCTION vertex.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vertex
AS $$
BEGIN
  INSERT INTO vertex.profiles (user_id, display_name, role)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'display_name', 'admin');
  RETURN NEW;
END;
$$;

-- Create trigger for automatic profile creation
-- Named vertex_on_auth_user_created (not the generic on_auth_user_created) because
-- auth.users is shared across every schema/app in this Supabase project, and a
-- same-named trigger already exists here for another app.
DROP TRIGGER IF EXISTS vertex_on_auth_user_created ON auth.users;
CREATE TRIGGER vertex_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION vertex.handle_new_user();

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON vertex.profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own profile" ON vertex.profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for products
CREATE POLICY "Authenticated users can view products" ON vertex.products
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin and operador can insert products" ON vertex.products
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND 
    vertex.get_current_user_role() IN ('admin', 'operador')
  );

CREATE POLICY "Admin and operador can update products" ON vertex.products
  FOR UPDATE USING (
    auth.uid() IS NOT NULL AND 
    vertex.get_current_user_role() IN ('admin', 'operador')
  );

CREATE POLICY "Only admin can delete products" ON vertex.products
  FOR DELETE USING (
    auth.uid() IS NOT NULL AND 
    vertex.get_current_user_role() = 'admin'
  );

-- RLS Policies for clients
CREATE POLICY "Authenticated users can view clients" ON vertex.clients
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin and operador can insert clients" ON vertex.clients
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND 
    vertex.get_current_user_role() IN ('admin', 'operador')
  );

CREATE POLICY "Admin and operador can update clients" ON vertex.clients
  FOR UPDATE USING (
    auth.uid() IS NOT NULL AND 
    vertex.get_current_user_role() IN ('admin', 'operador')
  );

CREATE POLICY "Only admin can delete clients" ON vertex.clients
  FOR DELETE USING (
    auth.uid() IS NOT NULL AND 
    vertex.get_current_user_role() = 'admin'
  );

-- RLS Policies for orders
CREATE POLICY "Authenticated users can view orders" ON vertex.orders
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin and operador can insert orders" ON vertex.orders
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND 
    vertex.get_current_user_role() IN ('admin', 'operador')
  );

CREATE POLICY "Admin and operador can update orders" ON vertex.orders
  FOR UPDATE USING (
    auth.uid() IS NOT NULL AND 
    vertex.get_current_user_role() IN ('admin', 'operador')
  );

CREATE POLICY "Only admin can delete orders" ON vertex.orders
  FOR DELETE USING (
    auth.uid() IS NOT NULL AND 
    vertex.get_current_user_role() = 'admin'
  );

-- RLS Policies for order_items
CREATE POLICY "Authenticated users can view order items" ON vertex.order_items
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin and operador can insert order items" ON vertex.order_items
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND 
    vertex.get_current_user_role() IN ('admin', 'operador')
  );

CREATE POLICY "Admin and operador can update order items" ON vertex.order_items
  FOR UPDATE USING (
    auth.uid() IS NOT NULL AND 
    vertex.get_current_user_role() IN ('admin', 'operador')
  );

CREATE POLICY "Only admin can delete order items" ON vertex.order_items
  FOR DELETE USING (
    auth.uid() IS NOT NULL AND 
    vertex.get_current_user_role() = 'admin'
  );

-- RLS Policies for investments
CREATE POLICY "Authenticated users can view investments" ON vertex.investments
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only admin can manage investments" ON vertex.investments
  FOR ALL USING (
    auth.uid() IS NOT NULL AND 
    vertex.get_current_user_role() = 'admin'
  );

-- RLS Policies for expired_products
CREATE POLICY "Authenticated users can view expired products" ON vertex.expired_products
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin and operador can manage expired products" ON vertex.expired_products
  FOR ALL USING (
    auth.uid() IS NOT NULL AND 
    vertex.get_current_user_role() IN ('admin', 'operador')
  );

-- RLS Policies for audit_logs
CREATE POLICY "Only admin can view audit logs" ON vertex.audit_logs
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND 
    vertex.get_current_user_role() = 'admin'
  );