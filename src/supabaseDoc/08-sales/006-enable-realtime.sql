-- ===========================================================
-- HABILITAR REALTIME PARA ACTUALIZACIONES EN TIEMPO REAL
-- ===========================================================

-- Habilitar realtime para la tabla sales
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;

-- Habilitar realtime para la tabla sale_items (opcional, para items individuales)
ALTER PUBLICATION supabase_realtime ADD TABLE public.sale_items;

-- Comentario:
-- Esto permite que los cambios en las tablas sales y sale_items
-- se transmitan en tiempo real a todos los clientes conectados
-- a través de Supabase Realtime subscriptions.