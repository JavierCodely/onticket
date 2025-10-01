-- ===========================================================
-- ACTUALIZACIÓN DE CATEGORÍAS DE PRODUCTOS
-- ===========================================================
-- Este script agrega nuevas categorías específicas de bebidas alcohólicas

-- Agregar nuevas categorías al enum product_category
ALTER TYPE product_category ADD VALUE IF NOT EXISTS 'vinos';
ALTER TYPE product_category ADD VALUE IF NOT EXISTS 'cervezas';
ALTER TYPE product_category ADD VALUE IF NOT EXISTS 'cocteles';
ALTER TYPE product_category ADD VALUE IF NOT EXISTS 'vodka';

/*
CATEGORÍAS DE PRODUCTOS ACTUALIZADAS:

Bebidas Alcohólicas Específicas:
- vinos: Vinos tintos, blancos, rosados, espumantes
- cervezas: Cervezas nacionales e importadas
- cocteles: Cocteles preparados (mojito, caipirinha, etc.)
- vodka: Vodka y derivados

Categorías Generales (existentes):
- bebidas_alcoholicas: Otras bebidas alcohólicas (whisky, ron, gin, etc.)
- bebidas_sin_alcohol: Gaseosas, agua, jugos
- comida: Comidas y snacks
- cigarrillos: Cigarrillos y tabaco
- merchandising: Productos del club (remeras, gorros, etc.)
- otros: Otros productos

NOTA: Los productos existentes con categoría 'bebidas_alcoholicas'
pueden ser migrados manualmente a las nuevas categorías específicas si es necesario.

EJEMPLO DE MIGRACIÓN:
-- Migrar cervezas
UPDATE products
SET category = 'cervezas'
WHERE category = 'bebidas_alcoholicas'
  AND (LOWER(name) LIKE '%cerveza%' OR LOWER(name) LIKE '%beer%');

-- Migrar vinos
UPDATE products
SET category = 'vinos'
WHERE category = 'bebidas_alcoholicas'
  AND (LOWER(name) LIKE '%vino%' OR LOWER(name) LIKE '%wine%');

-- Migrar vodka
UPDATE products
SET category = 'vodka'
WHERE category = 'bebidas_alcoholicas'
  AND LOWER(name) LIKE '%vodka%';
*/
